use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct McpServerEntry {
    pub name: String,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub env: Option<serde_json::Value>,
    pub transport: String,
    pub url: Option<String>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpServerRaw {
    command: Option<String>,
    #[serde(default)]
    args: Vec<String>,
    env: Option<serde_json::Value>,
    url: Option<String>,
    #[serde(rename = "type")]
    transport_type: Option<String>,
}

fn extract_mcp_from_file(path: &Path, source: &str) -> Vec<McpServerEntry> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let root: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let servers = match root.get("mcpServers") {
        Some(serde_json::Value::Object(map)) => map,
        _ => return Vec::new(),
    };

    let mut entries = Vec::new();
    for (name, value) in servers {
        let raw: McpServerRaw = serde_json::from_value(value.clone()).unwrap_or(McpServerRaw {
            command: None,
            args: Vec::new(),
            env: None,
            url: None,
            transport_type: None,
        });

        let transport = raw.transport_type.unwrap_or_else(|| {
            if raw.url.is_some() {
                "http".to_string()
            } else {
                "stdio".to_string()
            }
        });

        entries.push(McpServerEntry {
            name: name.clone(),
            command: raw.command,
            args: raw.args,
            env: raw.env,
            transport,
            url: raw.url,
            source: source.to_string(),
        });
    }

    entries
}

#[tauri::command]
pub async fn list_mcp_servers(cwd: Option<String>) -> Result<Vec<McpServerEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut all = Vec::new();

        // ~/.claude/settings.json
        if let Some(global_path) = crate::claude_paths::settings_json() {
            if global_path.is_file() {
                all.extend(extract_mcp_from_file(&global_path, "global"));
            }
        }

        // ~/.claude/.mcp.json
        if let Some(mcp_path) = crate::claude_paths::mcp_json() {
            if mcp_path.is_file() {
                all.extend(extract_mcp_from_file(&mcp_path, "global"));
            }
        }

        if let Some(ref cwd_str) = cwd {
            // <cwd>/.claude/settings.json
            if let Some(proj_path) = crate::claude_paths::project_settings_json(cwd_str) {
                if proj_path.is_file() {
                    all.extend(extract_mcp_from_file(&proj_path, "project"));
                }
            }
            // <cwd>/.claude/settings.local.json
            if let Some(local_path) = crate::claude_paths::project_settings_local_json(cwd_str) {
                if local_path.is_file() {
                    all.extend(extract_mcp_from_file(&local_path, "project-local"));
                }
            }
            // <cwd>/.mcp.json
            if let Some(proj_mcp) = crate::claude_paths::project_mcp_json(cwd_str) {
                if proj_mcp.is_file() {
                    all.extend(extract_mcp_from_file(&proj_mcp, "project"));
                }
            }
        }

        all.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(all)
    })
    .await
    .map_err(|e| e.to_string())?
}
