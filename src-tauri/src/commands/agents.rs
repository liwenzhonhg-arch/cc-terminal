//! Agent sidecar lifecycle — spawn / kill / send.
//!
//! 每个 agent = 一个 Node.js sidecar 进程，跑 @anthropic-ai/claude-agent-sdk。
//! Rust 端管理生命周期，stdin/stdout NDJSON 双向桥接到前端 Tauri 事件。

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Default)]
pub struct AgentState {
    agents: Mutex<HashMap<String, Arc<AgentHandle>>>,
}

pub(crate) struct AgentHandle {
    pub(crate) stdin: Mutex<ChildStdin>,
    pub(crate) child: Mutex<Child>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentLineEvent {
    agent_id: String,
    line: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentExitEvent {
    agent_id: String,
    code: Option<i32>,
}

const LINE_EVENT: &str = "agent:line";
const EXIT_EVENT: &str = "agent:exit";

fn sidecar_script_path() -> PathBuf {
    let mut path = std::env::current_exe().unwrap_or_default();
    path.pop(); // bin/
    // In dev: sidecar is at <project>/agent-sidecar/dist/sidecar.mjs
    // In prod: sidecar is bundled alongside the binary
    // For v0.1 we resolve relative to project root via env or fallback
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(&PathBuf::from("."))
        .join("agent-sidecar")
        .join("dist")
        .join("sidecar.mjs");
    if dev_path.exists() {
        return dev_path;
    }
    path.join("sidecar.mjs")
}

#[tauri::command]
pub async fn spawn_agent(
    app: AppHandle,
    state: State<'_, AgentState>,
    hello_json: String,
) -> Result<String, String> {
    let app_clone = app.clone();

    let (agent_id, handle) = tauri::async_runtime::spawn_blocking(move || -> Result<(String, Arc<AgentHandle>), String> {
        let script = sidecar_script_path();
        let mut cmd = Command::new("node");
        cmd.arg(&script);
        // node 进程 cwd 设到 agent-sidecar/ 以确保 node_modules 可被发现
        // 用户项目 cwd 通过 hello_json 传给 sidecar，sidecar 收到后 chdir
        let fallback = PathBuf::from(".");
        let sidecar_dir = script.parent().and_then(|d| d.parent())
            .unwrap_or(&fallback);
        cmd.current_dir(sidecar_dir);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        // Do NOT inject ANTHROPIC_API_KEY — let SDK use OAuth credentials
        cmd.env_remove("ANTHROPIC_API_KEY");

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("spawn sidecar 失败（确认 node 在 PATH）：{e}"))?;

        let mut stdin = child.stdin.take()
            .ok_or_else(|| "无法获取 sidecar stdin".to_string())?;
        let stdout = child.stdout.take()
            .ok_or_else(|| "无法获取 sidecar stdout".to_string())?;
        let stderr = child.stderr.take()
            .ok_or_else(|| "无法获取 sidecar stderr".to_string())?;

        // Send hello message immediately
        let hello_line = if hello_json.ends_with('\n') {
            hello_json
        } else {
            format!("{hello_json}\n")
        };
        stdin.write_all(hello_line.as_bytes())
            .map_err(|e| format!("写入 hello 失败：{e}"))?;
        stdin.flush()
            .map_err(|e| format!("flush hello 失败：{e}"))?;

        let agent_id = Uuid::new_v4().to_string();

        let handle = Arc::new(AgentHandle {
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
        });

        // stdout reader thread
        let app_out = app_clone.clone();
        let aid_out = agent_id.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                if line.is_empty() { continue; }
                let _ = app_out.emit(LINE_EVENT, AgentLineEvent {
                    agent_id: aid_out.clone(),
                    line,
                });
            }
        });

        // stderr reader thread (wrap as error events)
        let app_err = app_clone.clone();
        let aid_err = agent_id.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if line.is_empty() { continue; }
                let wrapped = format!(
                    r#"{{"type":"error","message":{}}}"#,
                    serde_json::to_string(&line).unwrap_or_default()
                );
                let _ = app_err.emit(LINE_EVENT, AgentLineEvent {
                    agent_id: aid_err.clone(),
                    line: wrapped,
                });
            }
        });

        // wait thread
        let app_wait = app_clone;
        let aid_wait = agent_id.clone();
        let handle_wait = handle.clone();
        std::thread::spawn(move || {
            let mut child_lock = handle_wait.child.lock().ok();
            let code = child_lock
                .as_mut()
                .and_then(|c| c.wait().ok())
                .and_then(|s| s.code());
            let _ = app_wait.emit(EXIT_EVENT, AgentExitEvent {
                agent_id: aid_wait,
                code,
            });
        });

        Ok((agent_id, handle))
    })
    .await
    .map_err(|e| format!("spawn_blocking 失败：{e}"))??;

    state.agents
        .lock()
        .map_err(|e| format!("agent lock 失败：{e}"))?
        .insert(agent_id.clone(), handle);

    Ok(agent_id)
}

#[tauri::command]
pub async fn send_to_agent(
    state: State<'_, AgentState>,
    agent_id: String,
    line: String,
) -> Result<(), String> {
    let handle = {
        let map = state.agents.lock()
            .map_err(|e| format!("agent lock 失败：{e}"))?;
        map.get(&agent_id).cloned()
            .ok_or_else(|| format!("agent {agent_id} 不存在"))?
    };
    let mut stdin = handle.stdin.lock()
        .map_err(|e| format!("stdin lock 失败：{e}"))?;
    let line = if line.ends_with('\n') { line } else { format!("{line}\n") };
    stdin.write_all(line.as_bytes())
        .map_err(|e| format!("写入失败：{e}"))?;
    stdin.flush()
        .map_err(|e| format!("flush 失败：{e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn kill_agent(
    state: State<'_, AgentState>,
    agent_id: String,
) -> Result<(), String> {
    let handle = {
        let mut map = state.agents.lock()
            .map_err(|e| format!("agent lock 失败：{e}"))?;
        map.remove(&agent_id)
            .ok_or_else(|| format!("agent {agent_id} 不存在"))?
    };
    // Send shutdown message first (graceful)
    if let Ok(mut stdin) = handle.stdin.lock() {
        let _ = stdin.write_all(b"{\"type\":\"shutdown\"}\n");
        let _ = stdin.flush();
    }
    // Then force kill after brief delay
    if let Ok(mut child) = handle.child.lock() {
        let _ = child.kill();
    }
    Ok(())
}

impl AgentState {
    pub fn kill_all(&self) {
        let mut map = match self.agents.lock() {
            Ok(m) => m,
            Err(_) => return,
        };
        for (_id, handle) in map.drain() {
            if let Ok(mut stdin) = handle.stdin.lock() {
                let _ = stdin.write_all(b"{\"type\":\"shutdown\"}\n");
                let _ = stdin.flush();
            }
            if let Ok(mut child) = handle.child.lock() {
                let _ = child.kill();
            }
        }
    }

    pub(crate) fn insert_handle(&self, id: String, handle: Arc<AgentHandle>) -> Result<(), String> {
        self.agents
            .lock()
            .map_err(|e| format!("agent lock 失败：{e}"))?
            .insert(id, handle);
        Ok(())
    }

    pub(crate) fn send_line(&self, agent_id: &str, line: &str) -> Result<(), String> {
        let handle = {
            let map = self.agents
                .lock()
                .map_err(|e| format!("agent lock 失败：{e}"))?;
            map.get(agent_id)
                .cloned()
                .ok_or_else(|| format!("agent {agent_id} 不存在"))?
        };
        let mut stdin = handle
            .stdin
            .lock()
            .map_err(|e| format!("stdin lock 失败：{e}"))?;
        let data = if line.ends_with('\n') {
            line.to_string()
        } else {
            format!("{line}\n")
        };
        stdin
            .write_all(data.as_bytes())
            .map_err(|e| format!("写入失败：{e}"))?;
        stdin
            .flush()
            .map_err(|e| format!("flush 失败：{e}"))?;
        Ok(())
    }

    pub(crate) fn kill_one(&self, agent_id: &str) {
        let handle = {
            let mut map = match self.agents.lock() {
                Ok(m) => m,
                Err(_) => return,
            };
            map.remove(agent_id)
        };
        if let Some(handle) = handle {
            if let Ok(mut stdin) = handle.stdin.lock() {
                let _ = stdin.write_all(b"{\"type\":\"shutdown\"}\n");
                let _ = stdin.flush();
            }
            if let Ok(mut child) = handle.child.lock() {
                let _ = child.kill();
            }
        }
    }
}

#[tauri::command]
pub async fn get_default_cwd() -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())?;
    Ok(home.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn open_login() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut cmd = Command::new("claude");
        cmd.args(["auth", "login", "--claudeai"]);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        cmd.spawn()
            .map_err(|e| format!("启动登录流程失败（确认 claude 在 PATH）：{e}"))?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("spawn_blocking 失败：{e}"))?
}
