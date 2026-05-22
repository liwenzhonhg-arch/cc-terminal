//! 统一入口：定位用户级 ~/.claude 目录及其下的 projects/、settings.json 等。
//!
//! 严格遵守 CLAUDE.md §7 红线：
//!  - 本模块只暴露**只读**路径访问；
//!  - jsonl 文件由调用方自行用流式只读打开（`File::open`），
//!    任何对 `~/.claude/projects/` 的写操作都不应在本项目出现。

use std::path::PathBuf;

/// 用户级 ~/.claude 目录。
pub fn claude_home() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// `~/.claude/projects/`，承载所有会话 jsonl。
pub fn projects_dir() -> Option<PathBuf> {
    claude_home().map(|p| p.join("projects"))
}

/// `~/.claude/skills/`，承载用户级 skill 目录（每个子目录一个 skill）。
pub fn skills_dir() -> Option<PathBuf> {
    claude_home().map(|p| p.join("skills"))
}

/// `~/.claude/plugins/`。
pub fn plugins_dir() -> Option<PathBuf> {
    claude_home().map(|p| p.join("plugins"))
}

/// `~/.claude/settings.json`（只读访问）。
pub fn settings_json() -> Option<PathBuf> {
    claude_home().map(|p| p.join("settings.json"))
}

/// `~/.claude/.mcp.json`（只读访问）。
pub fn mcp_json() -> Option<PathBuf> {
    claude_home().map(|p| p.join(".mcp.json"))
}

/// 项目级 `<cwd>/.mcp.json`（只读访问）。
/// 要求 cwd 为绝对路径，否则返回 None 防止路径遍历。
pub fn project_mcp_json(cwd: &str) -> Option<PathBuf> {
    let p = PathBuf::from(cwd);
    if !p.is_absolute() {
        return None;
    }
    Some(p.join(".mcp.json"))
}

/// 项目级 `<cwd>/.claude/settings.json`（只读访问）。
/// 要求 cwd 为绝对路径，否则返回 None 防止路径遍历。
pub fn project_settings_json(cwd: &str) -> Option<PathBuf> {
    let p = PathBuf::from(cwd);
    if !p.is_absolute() {
        return None;
    }
    Some(p.join(".claude").join("settings.json"))
}

/// 项目级 `<cwd>/.claude/settings.local.json`（只读访问）。
/// 要求 cwd 为绝对路径，否则返回 None 防止路径遍历。
pub fn project_settings_local_json(cwd: &str) -> Option<PathBuf> {
    let p = PathBuf::from(cwd);
    if !p.is_absolute() {
        return None;
    }
    Some(p.join(".claude").join("settings.local.json"))
}

/// 把 Claude Code 编码后的项目目录名解码回可读形式。
///
/// 编码规则（实测 2026-04）：把路径分隔符 / 与 Windows 盘符冒号 : 全部替换成 `-`，
/// 例如 `C:\Users\moonman` → `C--Users-moonman`，`/Users/foo/x` → `-Users-foo-x`。
///
/// 不存在 1:1 反解的可能（无法区分 `:` vs `/`），因此这里只做**展示用**还原：
/// 把全部 `-` 还原为系统分隔符，连续 `--` 还原为 `:`（Windows 启发式）。
#[allow(dead_code)]
pub fn decode_project_name(encoded: &str) -> String {
    encoded.replace("--", ":\\").replace('-', "\\")
}
