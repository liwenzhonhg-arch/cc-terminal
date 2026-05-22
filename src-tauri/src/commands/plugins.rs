use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct PluginEntry {
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub homepage: Option<String>,
    pub install_path: String,
    pub installed_at: Option<String>,
}

fn extract_author(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Object(map) => map
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    }
}

fn read_plugin_json(install_path: &Path) -> Option<serde_json::Value> {
    let plugin_json = install_path.join(".claude-plugin").join("plugin.json");
    if !plugin_json.is_file() {
        return None;
    }
    let content = fs::read_to_string(&plugin_json).ok()?;
    serde_json::from_str(&content).ok()
}

fn build_entry(name: &str, item: &serde_json::Value) -> PluginEntry {
    let install_path = item
        .get("installPath")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let installed_at = item
        .get("installedAt")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut version = None;
    let mut description = None;
    let mut author = None;
    let mut license = None;
    let mut homepage = None;

    if !install_path.is_empty() {
        if let Some(pj) = read_plugin_json(Path::new(&install_path)) {
            version = pj
                .get("version")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            description = pj
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            license = pj
                .get("license")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            homepage = pj
                .get("homepage")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if let Some(a) = pj.get("author") {
                author = extract_author(a);
            }
        }
    }

    PluginEntry {
        name: name.to_string(),
        version,
        description,
        author,
        license,
        homepage,
        install_path,
        installed_at,
    }
}

#[tauri::command]
pub async fn list_plugins() -> Result<Vec<PluginEntry>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let plugins_dir = crate::claude_paths::plugins_dir()
            .ok_or_else(|| "Cannot locate ~/.claude/plugins/".to_string())?;

        let index_path = plugins_dir.join("installed_plugins.json");
        if !index_path.is_file() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&index_path)
            .map_err(|e| format!("Failed to read installed_plugins.json: {e}"))?;

        let index: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse installed_plugins.json: {e}"))?;

        let mut entries = Vec::new();

        if let Some(arr) = index.as_array() {
            for item in arr {
                let name = item
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                entries.push(build_entry(name, item));
            }
        } else if let Some(plugins_map) = index.get("plugins").and_then(|v| v.as_object()) {
            for (key, versions) in plugins_map {
                let name = key.split('@').next().unwrap_or(key);
                if let Some(arr) = versions.as_array() {
                    if let Some(latest) = arr.first() {
                        entries.push(build_entry(name, latest));
                    }
                }
            }
        }

        entries.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}
