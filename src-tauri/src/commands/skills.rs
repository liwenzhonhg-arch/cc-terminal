use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct SkillEntry {
    pub name: String,
    pub namespace: Option<String>,
    pub description: Option<String>,
    pub path: String,
    pub content_preview: String,
}

fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (None, None, content.chars().take(500).collect());
    }

    let after_first = &trimmed[3..];
    if let Some(end_idx) = after_first.find("\n---") {
        let yaml_block = &after_first[..end_idx];
        let body_start = end_idx + 4;
        let body: String = after_first[body_start..].trim_start().chars().take(500).collect();

        let mut name: Option<String> = None;
        let mut description: Option<String> = None;

        if let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(yaml_block) {
            if let Some(map) = value.as_mapping() {
                if let Some(n) = map.get(serde_yaml::Value::String("name".into())) {
                    name = n.as_str().map(|s| s.to_string());
                }
                if let Some(d) = map.get(serde_yaml::Value::String("description".into())) {
                    description = d.as_str().map(|s| s.to_string());
                }
            }
        }

        (name, description, body)
    } else {
        (None, None, content.chars().take(500).collect())
    }
}

fn scan_skill_dir(dir: &Path, namespace: Option<&str>) -> Vec<SkillEntry> {
    let mut entries = Vec::new();
    let Ok(read_dir) = fs::read_dir(dir) else {
        return entries;
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let md_file = find_skill_md(&path);

        if let Some(md_path) = md_file {
            let content = fs::read_to_string(&md_path).unwrap_or_default();
            let (fm_name, description, preview) = parse_frontmatter(&content);

            entries.push(SkillEntry {
                name: fm_name.unwrap_or_else(|| dir_name.clone()),
                namespace: namespace.map(|s| s.to_string()),
                description,
                path: path.to_string_lossy().to_string(),
                content_preview: preview,
            });
        } else if namespace.is_none() {
            let sub = scan_skill_dir(&path, Some(&dir_name));
            entries.extend(sub);
        }
    }

    entries
}

fn find_skill_md(dir: &Path) -> Option<std::path::PathBuf> {
    let candidates = ["SKILL.md", "skill.md", "README.md", "readme.md"];
    for c in &candidates {
        let p = dir.join(c);
        if p.is_file() {
            return Some(p);
        }
    }
    if let Ok(read_dir) = fs::read_dir(dir) {
        for entry in read_dir.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext == "md" {
                        return Some(p);
                    }
                }
            }
        }
    }
    None
}

fn infer_namespaces(entries: &mut [SkillEntry]) {
    use std::collections::HashMap;

    let mut prefix_count: HashMap<String, usize> = HashMap::new();
    for entry in entries.iter() {
        if entry.namespace.is_some() {
            continue;
        }
        if let Some(prefix) = entry.name.split('-').next() {
            if prefix != entry.name {
                *prefix_count.entry(prefix.to_string()).or_insert(0) += 1;
            }
        }
    }

    let group_prefixes: std::collections::HashSet<String> = prefix_count
        .into_iter()
        .filter(|(_, count)| *count >= 3)
        .map(|(prefix, _)| prefix)
        .collect();

    for entry in entries.iter_mut() {
        if entry.namespace.is_some() {
            continue;
        }
        if let Some(prefix) = entry.name.split('-').next() {
            if prefix != entry.name && group_prefixes.contains(prefix) {
                entry.namespace = Some(prefix.to_string());
            }
        }
    }
}

#[tauri::command]
pub async fn list_skills() -> Result<Vec<SkillEntry>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let skills_dir = crate::claude_paths::skills_dir()
            .ok_or_else(|| "Cannot locate ~/.claude/skills/".to_string())?;

        if !skills_dir.is_dir() {
            return Ok(Vec::new());
        }

        let mut entries = scan_skill_dir(&skills_dir, None);
        infer_namespaces(&mut entries);
        Ok(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}
