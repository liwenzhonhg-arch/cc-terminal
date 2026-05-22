use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct HookEntry {
    pub event: String,
    pub matcher: Option<String>,
    pub hook_type: String,
    pub command: Option<String>,
    pub prompt: Option<String>,
    pub url: Option<String>,
    pub tool: Option<String>,
    pub condition: Option<String>,
    pub timeout: Option<u64>,
    pub source: String,
}

fn extract_hooks_from_file(path: &Path, source: &str) -> Vec<HookEntry> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let root: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let hooks_obj = match root.get("hooks") {
        Some(serde_json::Value::Object(map)) => map,
        _ => return Vec::new(),
    };

    let mut entries = Vec::new();

    for (event_name, matchers_val) in hooks_obj {
        let matchers = match matchers_val.as_array() {
            Some(arr) => arr,
            None => continue,
        };

        for matcher_group in matchers {
            let matcher = matcher_group
                .get("matcher")
                .and_then(|v| v.as_str())
                .map(String::from);

            let hooks_arr = match matcher_group.get("hooks").and_then(|v| v.as_array()) {
                Some(arr) => arr,
                None => continue,
            };

            for hook in hooks_arr {
                let hook_type = hook
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("command")
                    .to_string();

                entries.push(HookEntry {
                    event: event_name.clone(),
                    matcher: matcher.clone(),
                    hook_type,
                    command: hook.get("command").and_then(|v| v.as_str()).map(String::from),
                    prompt: hook.get("prompt").and_then(|v| v.as_str()).map(String::from),
                    url: hook.get("url").and_then(|v| v.as_str()).map(String::from),
                    tool: hook.get("tool").and_then(|v| v.as_str()).map(String::from),
                    condition: hook.get("if").and_then(|v| v.as_str()).map(String::from),
                    timeout: hook.get("timeout").and_then(|v| v.as_u64()),
                    source: source.to_string(),
                });
            }
        }
    }

    entries
}

#[tauri::command]
pub async fn list_hooks(cwd: Option<String>) -> Result<Vec<HookEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut all = Vec::new();

        if let Some(global_path) = crate::claude_paths::settings_json() {
            if global_path.is_file() {
                all.extend(extract_hooks_from_file(&global_path, "global"));
            }
        }

        if let Some(ref cwd_str) = cwd {
            if let Some(proj_path) = crate::claude_paths::project_settings_json(cwd_str) {
                if proj_path.is_file() {
                    all.extend(extract_hooks_from_file(&proj_path, "project"));
                }
            }
            if let Some(local_path) = crate::claude_paths::project_settings_local_json(cwd_str) {
                if local_path.is_file() {
                    all.extend(extract_hooks_from_file(&local_path, "project-local"));
                }
            }
        }

        Ok(all)
    })
    .await
    .map_err(|e| e.to_string())?
}
