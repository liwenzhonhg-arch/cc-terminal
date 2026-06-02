//! Git / GitHub CLI integration — status, diff, stage, commit, push, PR.
//!
//! All operations shell out to `git` / `gh` CLI via `std::process::Command`.
//! No git2 crate — keeps the dependency surface small and relies on the
//! user's existing git installation.

use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::Serialize;

// ─── Windows: hide console window ───────────────────────────────────────────

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn git_cmd(cwd: &str) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn gh_cmd(cwd: &str) -> Command {
    let mut cmd = Command::new("gh");
    cmd.current_dir(cwd);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

// ─── Path safety ────────────────────────────────────────────────────────────

fn validate_paths(paths: &[String]) -> Result<(), String> {
    for p in paths {
        let path = std::path::Path::new(p);
        if path.is_absolute() {
            return Err(format!("Absolute path not allowed: {p}"));
        }
        for comp in path.components() {
            if matches!(comp, std::path::Component::ParentDir) {
                return Err(format!("Path traversal not allowed: {p}"));
            }
        }
    }
    Ok(())
}

fn validate_ref_name(name: &str, label: &str) -> Result<(), String> {
    if name.starts_with('-') {
        return Err(format!("{label} must not start with '-': {name}"));
    }
    if name.contains("..") || name.contains(' ') || name.contains('\0') {
        return Err(format!("Invalid {label}: {name}"));
    }
    Ok(())
}

// ─── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<GitFileStatus>,
    pub is_clean: bool,
    pub has_staged: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitResult {
    pub hash: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GhPrResult {
    pub url: String,
    pub number: u32,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn run_output(cmd: &mut Command) -> Result<String, String> {
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run command: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let msg = if stderr.is_empty() {
            stdout.to_string()
        } else {
            stderr.to_string()
        };
        return Err(msg.trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ─── Commands ───────────────────────────────────────────────────────────────

/// Parse `git status --porcelain=v2 -b` output.
#[tauri::command]
pub async fn git_status(cwd: String) -> Result<GitStatusResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_output(
            git_cmd(&cwd).args(["status", "--porcelain=v2", "-b"]),
        )?;

        let mut branch = String::from("HEAD");
        let mut upstream: Option<String> = None;
        let mut ahead: u32 = 0;
        let mut behind: u32 = 0;
        let mut files: Vec<GitFileStatus> = Vec::new();

        for line in output.lines() {
            if line.starts_with("# branch.head ") {
                branch = line.strip_prefix("# branch.head ").unwrap_or("HEAD").to_string();
            } else if line.starts_with("# branch.upstream ") {
                upstream = line.strip_prefix("# branch.upstream ").map(String::from);
            } else if line.starts_with("# branch.ab ") {
                // "# branch.ab +3 -1"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    ahead = parts[2].trim_start_matches('+').parse().unwrap_or(0);
                    behind = parts[3].trim_start_matches('-').parse().unwrap_or(0);
                }
            } else if line.starts_with("1 ") || line.starts_with("2 ") {
                // Ordinary / renamed entry: "1 XY sub mH mI mW hH hI path"
                let parts: Vec<&str> = line.splitn(9, ' ').collect();
                if parts.len() >= 9 {
                    let xy = parts[1];
                    let path = parts[8];
                    let x = xy.chars().next().unwrap_or('.');
                    let y = xy.chars().nth(1).unwrap_or('.');

                    if x != '.' {
                        files.push(GitFileStatus {
                            path: path.to_string(),
                            status: x.to_string(),
                            staged: true,
                        });
                    }
                    if y != '.' {
                        files.push(GitFileStatus {
                            path: path.to_string(),
                            status: y.to_string(),
                            staged: false,
                        });
                    }
                }
            } else if line.starts_with("? ") {
                // Untracked: "? path"
                let path = line.strip_prefix("? ").unwrap_or("");
                files.push(GitFileStatus {
                    path: path.to_string(),
                    status: "?".to_string(),
                    staged: false,
                });
            }
        }

        let has_staged = files.iter().any(|f| f.staged);
        let is_clean = files.is_empty();

        Ok(GitStatusResult {
            branch,
            upstream,
            ahead,
            behind,
            files,
            is_clean,
            has_staged,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get unified diff output.
#[tauri::command]
pub async fn git_diff(
    cwd: String,
    staged: bool,
    paths: Vec<String>,
) -> Result<String, String> {
    validate_paths(&paths)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = git_cmd(&cwd);
        cmd.arg("diff");
        if staged {
            cmd.arg("--cached");
        }
        if !paths.is_empty() {
            cmd.arg("--");
            for p in &paths {
                cmd.arg(p);
            }
        }
        let output = run_output(&mut cmd)?;

        let lines: Vec<&str> = output.lines().collect();
        if lines.len() > 500 {
            let truncated: String = lines[..500].join("\n");
            Ok(format!("{truncated}\n\n... diff truncated ({} lines total) ...", lines.len()))
        } else {
            Ok(output)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Stage or unstage files.
#[tauri::command]
pub async fn git_stage(
    cwd: String,
    paths: Vec<String>,
    unstage: bool,
) -> Result<(), String> {
    validate_paths(&paths)?;
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = git_cmd(&cwd);
        if unstage {
            cmd.args(["restore", "--staged"]);
        } else {
            cmd.arg("add");
        }
        for p in &paths {
            cmd.arg(p);
        }
        run_output(&mut cmd)?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Create a commit with the given message.
#[tauri::command]
pub async fn git_commit(cwd: String, message: String) -> Result<GitCommitResult, String> {
    if message.trim().is_empty() {
        return Err("Commit message must not be empty".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_output(
            git_cmd(&cwd).args(["commit", "-m", &message]),
        )?;

        // Parse commit hash from output like "[main abc1234] message"
        let hash = output
            .lines()
            .next()
            .and_then(|line| {
                let start = line.find(' ')? + 1;
                let end = line.find(']')?;
                Some(line[start..end].to_string())
            })
            .ok_or_else(|| format!("Commit succeeded but failed to parse hash from: {output}"))?;

        Ok(GitCommitResult { hash, message })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Push to remote. Optionally set upstream.
#[tauri::command]
pub async fn git_push(cwd: String, set_upstream: Option<String>) -> Result<String, String> {
    if let Some(ref branch) = set_upstream {
        validate_ref_name(branch, "branch")?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = git_cmd(&cwd);
        cmd.arg("push");
        if let Some(branch) = &set_upstream {
            cmd.args(["--set-upstream", "origin", branch]);
        }
        run_output(&mut cmd)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Create a GitHub PR via `gh pr create`.
#[tauri::command]
pub async fn gh_pr_create(
    cwd: String,
    title: String,
    body: String,
    base: Option<String>,
) -> Result<GhPrResult, String> {
    if title.trim().is_empty() {
        return Err("PR title must not be empty".to_string());
    }
    if let Some(ref b) = base {
        validate_ref_name(b, "base branch")?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = gh_cmd(&cwd);
        cmd.args(["pr", "create", "--title", &title, "--body", &body]);
        if let Some(b) = &base {
            cmd.args(["--base", b]);
        }
        let output = run_output(&mut cmd)?;

        // gh pr create outputs the PR URL on success
        let url = output.trim().to_string();
        let number = url
            .rsplit('/')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        Ok(GhPrResult { url, number })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Check if `gh` CLI is authenticated.
#[tauri::command]
pub async fn gh_auth_status() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut cmd = Command::new("gh");
        cmd.args(["auth", "status"]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        match cmd.output() {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
