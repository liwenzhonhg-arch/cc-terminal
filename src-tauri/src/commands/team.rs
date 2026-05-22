//! Multi-agent team chat — create teams, add/remove agents, route messages.
//!
//! Each team agent is a standard sidecar process (reusing agents.rs spawn logic).
//! Events go through `team:line` / `team:exit` channels, isolated from `agent:line`.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use super::agents::{AgentHandle, AgentState};

// === Types ===

#[derive(Default)]
pub struct TeamState {
    teams: Mutex<HashMap<String, TeamConfig>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TeamConfig {
    pub id: String,
    pub name: String,
    pub cwd: String,
    pub lead: Option<TeamAgent>,
    pub members: Vec<TeamAgent>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TeamAgent {
    pub name: String,
    pub role: String,
    pub description: String,
    pub agent_id: Option<String>,
    pub status: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TeamLineEvent {
    team_id: String,
    agent_id: String,
    agent_name: String,
    agent_role: String,
    line: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TeamExitEvent {
    team_id: String,
    agent_id: String,
    agent_name: String,
    code: Option<i32>,
}

const TEAM_LINE_EVENT: &str = "team:line";
const TEAM_EXIT_EVENT: &str = "team:exit";

// === Helpers ===

fn sidecar_script_path() -> std::path::PathBuf {
    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(&std::path::PathBuf::from("."))
        .join("agent-sidecar")
        .join("dist")
        .join("sidecar.mjs");
    if dev_path.exists() {
        return dev_path;
    }
    let mut path = std::env::current_exe().unwrap_or_default();
    path.pop();
    path.join("sidecar.mjs")
}

fn build_system_prompt(
    team: &TeamConfig,
    agent_name: &str,
    role: &str,
    description: &str,
) -> String {
    if role == "lead" {
        let member_list: Vec<String> = team
            .members
            .iter()
            .map(|m| format!("- @{}: {}", m.name, m.description))
            .collect();
        let members_str = if member_list.is_empty() {
            "No members yet.".to_string()
        } else {
            member_list.join("\n")
        };
        format!(
            "You are the Team Lead of a multi-agent team. Your role: {description}.\n\
             Team members:\n{members_str}\n\
             Coordinate tasks, delegate to members when appropriate.\n\
             Current working directory: {}",
            team.cwd
        )
    } else {
        let lead_name = team
            .lead
            .as_ref()
            .map(|l| l.name.as_str())
            .unwrap_or("lead");
        format!(
            "You are a team member named '{agent_name}'. Your specialty: {description}.\n\
             You are part of a team led by '@{lead_name}'.\n\
             Focus on your area of expertise.\n\
             Current working directory: {}",
            team.cwd
        )
    }
}

// === Commands ===

#[tauri::command]
pub async fn create_team(
    state: State<'_, TeamState>,
    name: String,
    cwd: String,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let config = TeamConfig {
        id: id.clone(),
        name,
        cwd,
        lead: None,
        members: Vec::new(),
    };
    state
        .teams
        .lock()
        .map_err(|e| format!("team lock 失败：{e}"))?
        .insert(id.clone(), config);
    Ok(id)
}

#[tauri::command]
pub async fn add_team_agent(
    app: AppHandle,
    team_state: State<'_, TeamState>,
    agent_state: State<'_, AgentState>,
    team_id: String,
    agent_name: String,
    role: String,
    description: String,
) -> Result<String, String> {
    let (system_prompt, cwd) = {
        let teams = team_state
            .teams
            .lock()
            .map_err(|e| format!("team lock 失败：{e}"))?;
        let team = teams
            .get(&team_id)
            .ok_or_else(|| format!("team {team_id} 不存在"))?;
        let prompt = build_system_prompt(team, &agent_name, &role, &description);
        (prompt, team.cwd.clone())
    };

    let app_clone = app.clone();
    let team_id_c = team_id.clone();
    let agent_name_c = agent_name.clone();
    let role_c = role.clone();

    let (agent_id, handle) = tauri::async_runtime::spawn_blocking(move || -> Result<(String, Arc<AgentHandle>), String> {
        let script = sidecar_script_path();
        let mut cmd = Command::new("node");
        cmd.arg(&script);
        let fallback = std::path::PathBuf::from(".");
        let sidecar_dir = script.parent().and_then(|d| d.parent()).unwrap_or(&fallback);
        cmd.current_dir(sidecar_dir);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        cmd.env_remove("ANTHROPIC_API_KEY");

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("spawn team sidecar 失败：{e}"))?;

        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法获取 team sidecar stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "无法获取 team sidecar stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "无法获取 team sidecar stderr".to_string())?;

        // Send hello
        let hello = serde_json::json!({
            "type": "hello",
            "cwd": cwd,
            "systemPrompt": system_prompt,
            "model": "claude-opus-4-6",
            "permissionMode": "acceptEdits",
        });
        let hello_line = format!("{}\n", hello);
        stdin
            .write_all(hello_line.as_bytes())
            .map_err(|e| format!("写入 team hello 失败：{e}"))?;
        stdin
            .flush()
            .map_err(|e| format!("flush team hello 失败：{e}"))?;

        let agent_id = Uuid::new_v4().to_string();

        let handle = Arc::new(AgentHandle {
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
        });

        // stdout → team:line
        {
            let app_out = app_clone.clone();
            let tid = team_id_c.clone();
            let aname = agent_name_c.clone();
            let arole = role_c.clone();
            let aid = agent_id.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    if line.is_empty() {
                        continue;
                    }
                    let _ = app_out.emit(
                        TEAM_LINE_EVENT,
                        TeamLineEvent {
                            team_id: tid.clone(),
                            agent_id: aid.clone(),
                            agent_name: aname.clone(),
                            agent_role: arole.clone(),
                            line,
                        },
                    );
                }
            });
        }

        // stderr → team:line (wrapped as error)
        {
            let app_err = app_clone.clone();
            let tid = team_id_c.clone();
            let aname = agent_name_c.clone();
            let arole = role_c.clone();
            let aid = agent_id.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    if line.is_empty() {
                        continue;
                    }
                    let wrapped = format!(
                        r#"{{"type":"error","message":{}}}"#,
                        serde_json::to_string(&line).unwrap_or_default()
                    );
                    let _ = app_err.emit(
                        TEAM_LINE_EVENT,
                        TeamLineEvent {
                            team_id: tid.clone(),
                            agent_id: aid.clone(),
                            agent_name: aname.clone(),
                            agent_role: arole.clone(),
                            line: wrapped,
                        },
                    );
                }
            });
        }

        // wait → team:exit
        {
            let app_wait = app_clone;
            let tid = team_id_c;
            let aname = agent_name_c;
            let aid = agent_id.clone();
            let handle_wait = handle.clone();
            std::thread::spawn(move || {
                let mut child_lock = handle_wait.child.lock().ok();
                let code = child_lock
                    .as_mut()
                    .and_then(|c| c.wait().ok())
                    .and_then(|s| s.code());
                let _ = app_wait.emit(
                    TEAM_EXIT_EVENT,
                    TeamExitEvent {
                        team_id: tid,
                        agent_id: aid,
                        agent_name: aname,
                        code,
                    },
                );
            });
        }

        Ok((agent_id, handle))
    })
    .await
    .map_err(|e| format!("spawn_blocking 失败：{e}"))??;

    // Register in AgentState
    agent_state.insert_handle(agent_id.clone(), handle)?;

    // Update team config
    let mut teams = team_state
        .teams
        .lock()
        .map_err(|e| format!("team lock 失败：{e}"))?;
    if let Some(team) = teams.get_mut(&team_id) {
        let agent = TeamAgent {
            name: agent_name,
            role: role.clone(),
            description,
            agent_id: Some(agent_id.clone()),
            status: "idle".to_string(),
        };
        if role == "lead" {
            team.lead = Some(agent);
        } else {
            team.members.push(agent);
        }
    }

    Ok(agent_id)
}

#[tauri::command]
pub async fn send_to_team(
    team_state: State<'_, TeamState>,
    agent_state: State<'_, AgentState>,
    team_id: String,
    content: String,
    target_agent: Option<String>,
) -> Result<(), String> {
    let target_agent_id = {
        let teams = team_state
            .teams
            .lock()
            .map_err(|e| format!("team lock 失败：{e}"))?;
        let team = teams
            .get(&team_id)
            .ok_or_else(|| format!("team {team_id} 不存在"))?;

        match target_agent {
            Some(ref name) => {
                let from_lead = team
                    .lead
                    .as_ref()
                    .filter(|l| &l.name == name)
                    .and_then(|l| l.agent_id.clone());
                from_lead.or_else(|| {
                    team.members
                        .iter()
                        .find(|m| &m.name == name)
                        .and_then(|m| m.agent_id.clone())
                })
            }
            None => team.lead.as_ref().and_then(|l| l.agent_id.clone()),
        }
    };

    let agent_id = target_agent_id.ok_or_else(|| "目标 agent 不存在或未就绪".to_string())?;
    let line = serde_json::json!({ "type": "user", "content": content }).to_string();
    agent_state.send_line(&agent_id, &line)
}

#[tauri::command]
pub async fn remove_team_agent(
    team_state: State<'_, TeamState>,
    agent_state: State<'_, AgentState>,
    team_id: String,
    agent_name: String,
) -> Result<(), String> {
    let agent_id = {
        let mut teams = team_state
            .teams
            .lock()
            .map_err(|e| format!("team lock 失败：{e}"))?;
        let team = teams
            .get_mut(&team_id)
            .ok_or_else(|| format!("team {team_id} 不存在"))?;

        let is_lead = team
            .lead
            .as_ref()
            .map(|l| l.name == agent_name)
            .unwrap_or(false);

        if is_lead {
            let aid = team.lead.as_ref().and_then(|l| l.agent_id.clone());
            team.lead = None;
            aid
        } else {
            let idx = team
                .members
                .iter()
                .position(|m| m.name == agent_name)
                .ok_or_else(|| format!("agent {agent_name} 不在 team 中"))?;
            let member = team.members.remove(idx);
            member.agent_id
        }
    };

    if let Some(aid) = agent_id {
        agent_state.kill_one(&aid);
    }
    Ok(())
}

#[tauri::command]
pub async fn disband_team(
    team_state: State<'_, TeamState>,
    agent_state: State<'_, AgentState>,
    team_id: String,
) -> Result<(), String> {
    let team = {
        let mut teams = team_state
            .teams
            .lock()
            .map_err(|e| format!("team lock 失败：{e}"))?;
        teams
            .remove(&team_id)
            .ok_or_else(|| format!("team {team_id} 不存在"))?
    };

    if let Some(lead) = &team.lead {
        if let Some(aid) = &lead.agent_id {
            agent_state.kill_one(aid);
        }
    }
    for member in &team.members {
        if let Some(aid) = &member.agent_id {
            agent_state.kill_one(aid);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_team(
    state: State<'_, TeamState>,
    team_id: String,
) -> Result<TeamConfig, String> {
    let teams = state
        .teams
        .lock()
        .map_err(|e| format!("team lock 失败：{e}"))?;
    teams
        .get(&team_id)
        .cloned()
        .ok_or_else(|| format!("team {team_id} 不存在"))
}

