use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntry {
    pub session_id: String,
    pub cwd: String,
    pub last_modified: u64,
    pub file_size: u64,
    pub title: Option<String>,
}

#[tauri::command]
pub async fn list_sessions() -> Result<Vec<SessionEntry>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let projects_dir =
            crate::claude_paths::projects_dir().ok_or("Cannot find ~/.claude/projects")?;

        if !projects_dir.exists() {
            return Ok(Vec::new());
        }

        let mut entries = Vec::new();

        let project_dirs = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;
        for project_entry in project_dirs.flatten() {
            let project_path = project_entry.path();
            if !project_path.is_dir() {
                continue;
            }

            let files = match fs::read_dir(&project_path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            for file_entry in files.flatten() {
                let path = file_entry.path();
                let ext = path.extension().and_then(|e| e.to_str());
                if ext != Some("jsonl") {
                    continue;
                }

                let session_id = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();

                let meta = match fs::metadata(&path) {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let mtime = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                let (cwd, title) = peek_metadata(&path);
                let cwd = match cwd {
                    Some(c) => c,
                    None => continue,
                };

                entries.push(SessionEntry {
                    session_id,
                    cwd,
                    last_modified: mtime,
                    file_size: meta.len(),
                    title,
                });
            }
        }

        entries.sort_by_key(|e| std::cmp::Reverse(e.last_modified));
        Ok(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn peek_metadata(path: &Path) -> (Option<String>, Option<String>) {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None),
    };
    let reader = BufReader::new(file);

    let mut cwd: Option<String> = None;
    let mut title: Option<String> = None;

    for (i, line) in reader.lines().enumerate() {
        if i > 50 {
            break;
        }
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        let v: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if cwd.is_none() {
            if let Some(c) = v["cwd"].as_str() {
                if !c.is_empty() {
                    cwd = Some(c.to_string());
                }
            }
        }

        if title.is_none() {
            let msg_type = v["type"].as_str().unwrap_or("");

            if msg_type == "custom-title" {
                if let Some(t) = v["title"].as_str().or_else(|| v["customTitle"].as_str()) {
                    if !t.is_empty() {
                        title = Some(truncate_title(t));
                    }
                }
            }

            if msg_type == "user" {
                if let Some(content) = v["message"]["content"].as_array() {
                    for block in content {
                        if let Some(text) = block["text"].as_str() {
                            if !text.starts_with('<') && !text.is_empty() {
                                title = Some(truncate_title(text));
                                break;
                            }
                        }
                    }
                }
            }
        }

        if cwd.is_some() && title.is_some() {
            break;
        }
    }

    (cwd, title)
}

/// A single message extracted from a session jsonl file.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<u64>,
}

/// Read messages from a session jsonl file for display in the chat view.
/// Scans all `~/.claude/projects/` subdirectories for a file named `<sessionId>.jsonl`.
#[tauri::command]
pub async fn load_session_messages(session_id: String) -> Result<Vec<SessionMessage>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let projects_dir =
            crate::claude_paths::projects_dir().ok_or("Cannot find ~/.claude/projects")?;

        let target = format!("{session_id}.jsonl");
        let mut found_path: Option<std::path::PathBuf> = None;

        for project_entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())?.flatten() {
            let candidate = project_entry.path().join(&target);
            if candidate.exists() {
                found_path = Some(candidate);
                break;
            }
        }

        let path = found_path.ok_or_else(|| format!("Session {session_id} not found"))?;
        let file = fs::File::open(&path).map_err(|e| e.to_string())?;
        let reader = BufReader::new(file);

        let mut messages = Vec::new();

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };

            let v: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let msg_type = match v["type"].as_str() {
                Some(t) => t,
                None => continue,
            };

            let ts = v["timestamp"]
                .as_str()
                .and_then(|s| s.parse::<f64>().ok())
                .map(|f| (f * 1000.0) as u64);

            match msg_type {
                "user" => {
                    if let Some(arr) = v["message"]["content"].as_array() {
                        for block in arr {
                            let block_type = block["type"].as_str().unwrap_or("");
                            match block_type {
                                "text" => {
                                    if let Some(text) = block["text"].as_str() {
                                        if !text.is_empty() && !text.starts_with('<') {
                                            messages.push(SessionMessage {
                                                role: "user".to_string(),
                                                content: text.to_string(),
                                                timestamp: ts,
                                            });
                                        }
                                    }
                                }
                                "tool_result" => {
                                    let result_text =
                                        extract_text_content(&block["content"]);
                                    if result_text.is_empty() {
                                        continue;
                                    }
                                    let tool_use_id = block["tool_use_id"]
                                        .as_str()
                                        .unwrap_or("");
                                    let is_error =
                                        block["is_error"].as_bool().unwrap_or(false);
                                    let meta = serde_json::json!({
                                        "toolUseId": tool_use_id,
                                        "isError": is_error,
                                        "text": result_text
                                    });
                                    messages.push(SessionMessage {
                                        role: "tool_result".to_string(),
                                        content: meta.to_string(),
                                        timestamp: ts,
                                    });
                                }
                                _ => {}
                            }
                        }
                    }
                }
                "assistant" => {
                    let content_val = &v["message"]["content"];
                    if let Some(arr) = content_val.as_array() {
                        for block in arr {
                            let block_type = block["type"].as_str().unwrap_or("");
                            match block_type {
                                "text" => {
                                    if let Some(text) = block["text"].as_str() {
                                        if !text.is_empty() {
                                            messages.push(SessionMessage {
                                                role: "assistant".to_string(),
                                                content: text.to_string(),
                                                timestamp: ts,
                                            });
                                        }
                                    }
                                }
                                "tool_use" => {
                                    let block_json = serde_json::to_string(block)
                                        .unwrap_or_default();
                                    messages.push(SessionMessage {
                                        role: "tool_use".to_string(),
                                        content: block_json,
                                        timestamp: ts,
                                    });
                                }
                                _ => {}
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(messages)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn extract_text_content(content: &serde_json::Value) -> String {
    if let Some(s) = content.as_str() {
        return s.to_string();
    }
    if let Some(arr) = content.as_array() {
        let texts: Vec<&str> = arr
            .iter()
            .filter_map(|b| {
                if b["type"].as_str() == Some("text") {
                    b["text"].as_str()
                } else {
                    None
                }
            })
            .collect();
        return texts.join("\n");
    }
    String::new()
}

fn truncate_title(text: &str) -> String {
    let first_line = text.lines().next().unwrap_or(text).trim();
    let truncated: String = first_line.chars().take(40).collect();
    if truncated.len() < first_line.len() {
        format!("{truncated}…")
    } else {
        truncated
    }
}
