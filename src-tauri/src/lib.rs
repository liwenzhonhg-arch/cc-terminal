mod claude_paths;
mod commands;
#[allow(dead_code)]
mod pricing;

use commands::agents::AgentState;
use commands::team::TeamState;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AgentState::default())
        .manage(TeamState::default())
        .invoke_handler(tauri::generate_handler![
            commands::agents::spawn_agent,
            commands::agents::send_to_agent,
            commands::agents::kill_agent,
            commands::agents::get_default_cwd,
            commands::agents::open_login,
            commands::sessions::list_sessions,
            commands::sessions::load_session_messages,
            commands::usage::get_usage_stats,
            commands::skills::list_skills,
            commands::mcp::list_mcp_servers,
            commands::plugins::list_plugins,
            commands::hooks::list_hooks,
            commands::team::create_team,
            commands::team::add_team_agent,
            commands::team::send_to_team,
            commands::team::remove_team_agent,
            commands::team::disband_team,
            commands::team::get_team,
            commands::git::git_status,
            commands::git::git_diff,
            commands::git::git_stage,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::gh_pr_create,
            commands::git::gh_auth_status,
        ])
        .setup(|_app| {
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<AgentState>() {
                    state.kill_all();
                }
            }
        });
}
