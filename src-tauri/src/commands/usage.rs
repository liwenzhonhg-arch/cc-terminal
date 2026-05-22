use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DailyUsage {
    pub date: String,
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    pub cost_usd: f64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageSummary {
    pub total_input: u64,
    pub total_output: u64,
    pub total_cache_read: u64,
    pub total_cache_write: u64,
    pub total_cost_usd: f64,
    pub window5h_cost_usd: f64,
    pub window5h_input: u64,
    pub window5h_output: u64,
    pub window5h_cache_read: u64,
    pub window5h_cache_write: u64,
    pub week_cost_usd: f64,
    pub week_input: u64,
    pub week_output: u64,
    pub week_cache_read: u64,
    pub week_cache_write: u64,
    pub daily: Vec<DailyUsage>,
}

#[tauri::command]
pub async fn get_usage_stats(days: Option<u32>) -> Result<UsageSummary, String> {
    let max_days = days.unwrap_or(30) as i64;

    tauri::async_runtime::spawn_blocking(move || {
        let projects_dir =
            crate::claude_paths::projects_dir().ok_or("Cannot find ~/.claude/projects")?;

        if !projects_dir.exists() {
            return Ok(UsageSummary {
                total_input: 0,
                total_output: 0,
                total_cache_read: 0,
                total_cache_write: 0,
                total_cost_usd: 0.0,
                window5h_cost_usd: 0.0,
                window5h_input: 0,
                window5h_output: 0,
                window5h_cache_read: 0,
                window5h_cache_write: 0,
                week_cost_usd: 0.0,
                week_input: 0,
                week_output: 0,
                week_cache_read: 0,
                week_cache_write: 0,
                daily: Vec::new(),
            });
        }

        let now_secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cutoff_ts = now_secs.saturating_sub(max_days as u64 * 86400);

        let cutoff_5h = now_secs.saturating_sub(5 * 3600);
        let cutoff_week = now_secs.saturating_sub(7 * 86400);
        let mut window5h_cost: f64 = 0.0;
        let mut window5h_in: u64 = 0;
        let mut window5h_out: u64 = 0;
        let mut window5h_cr: u64 = 0;
        let mut window5h_cw: u64 = 0;
        let mut week_cost: f64 = 0.0;
        let mut week_in: u64 = 0;
        let mut week_out: u64 = 0;
        let mut week_cr: u64 = 0;
        let mut week_cw: u64 = 0;

        let mut daily_map: BTreeMap<String, DailyUsage> = BTreeMap::new();

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
                if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                    continue;
                }

                let file = match fs::File::open(&path) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                let reader = BufReader::new(file);
                for line in reader.lines() {
                    let line = match line {
                        Ok(l) => l,
                        Err(_) => continue,
                    };

                    let v: serde_json::Value = match serde_json::from_str(&line) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };

                    let usage = &v["message"]["usage"];
                    if usage.is_null() {
                        continue;
                    }

                    let input = usage["input_tokens"].as_u64().unwrap_or(0);
                    let output = usage["output_tokens"].as_u64().unwrap_or(0);
                    let cache_read = usage["cache_read_input_tokens"].as_u64().unwrap_or(0);
                    let cache_write = usage["cache_creation_input_tokens"].as_u64().unwrap_or(0);

                    if input == 0 && output == 0 {
                        continue;
                    }

                    let ts_secs = parse_timestamp(&v["timestamp"]);

                    if ts_secs < cutoff_ts {
                        continue;
                    }

                    let model = v["message"]["model"].as_str().unwrap_or("claude-sonnet-4-6");
                    let cost = crate::pricing::cost_usd(model, input, output, cache_read, cache_write);

                    let date = format_date(ts_secs);

                    let entry = daily_map.entry(date.clone()).or_insert_with(|| DailyUsage {
                        date,
                        ..Default::default()
                    });
                    entry.input += input;
                    entry.output += output;
                    entry.cache_read += cache_read;
                    entry.cache_write += cache_write;
                    entry.cost_usd += cost;

                    if ts_secs >= cutoff_5h {
                        window5h_cost += cost;
                        window5h_in += input;
                        window5h_out += output;
                        window5h_cr += cache_read;
                        window5h_cw += cache_write;
                    }
                    if ts_secs >= cutoff_week {
                        week_cost += cost;
                        week_in += input;
                        week_out += output;
                        week_cr += cache_read;
                        week_cw += cache_write;
                    }
                }
            }
        }

        let daily: Vec<DailyUsage> = daily_map.into_values().collect();

        let total_input: u64 = daily.iter().map(|d| d.input).sum();
        let total_output: u64 = daily.iter().map(|d| d.output).sum();
        let total_cache_read: u64 = daily.iter().map(|d| d.cache_read).sum();
        let total_cache_write: u64 = daily.iter().map(|d| d.cache_write).sum();
        let total_cost_usd: f64 = daily.iter().map(|d| d.cost_usd).sum();

        Ok(UsageSummary {
            total_input,
            total_output,
            total_cache_read,
            total_cache_write,
            total_cost_usd,
            window5h_cost_usd: window5h_cost,
            window5h_input: window5h_in,
            window5h_output: window5h_out,
            window5h_cache_read: window5h_cr,
            window5h_cache_write: window5h_cw,
            week_cost_usd: week_cost,
            week_input: week_in,
            week_output: week_out,
            week_cache_read: week_cr,
            week_cache_write: week_cw,
            daily,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn parse_timestamp(val: &serde_json::Value) -> u64 {
    if let Some(n) = val.as_f64() {
        return n as u64;
    }
    let s = match val.as_str() {
        Some(s) => s,
        None => return 0,
    };
    if let Ok(f) = s.parse::<f64>() {
        return f as u64;
    }
    // ISO 8601: "2026-04-29T14:18:00.980Z" or "2026-04-29T14:18:00Z"
    if s.len() < 19 {
        return 0;
    }
    let b = s.as_bytes();
    let year = parse_digits(b, 0, 4) as i64;
    let month = parse_digits(b, 5, 7);
    let day = parse_digits(b, 8, 10);
    let hour = parse_digits(b, 11, 13);
    let min = parse_digits(b, 14, 16);
    let sec = parse_digits(b, 17, 19);
    if year == 0 || month == 0 || month > 12 || day == 0 || day > 31 {
        return 0;
    }
    let month_days = if is_leap(year) {
        [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut days: u64 = 0;
    for y in 1970..year {
        days += if is_leap(y) { 366 } else { 365 };
    }
    for m in 1..month {
        days += month_days[m as usize] as u64;
    }
    days += (day - 1) as u64;
    days * 86400 + hour as u64 * 3600 + min as u64 * 60 + sec as u64
}

fn parse_digits(b: &[u8], from: usize, to: usize) -> u32 {
    let mut n: u32 = 0;
    for &c in &b[from..to] {
        if !c.is_ascii_digit() {
            return 0;
        }
        n = n * 10 + (c - b'0') as u32;
    }
    n
}

fn format_date(ts_secs: u64) -> String {
    const SECS_PER_DAY: u64 = 86400;
    let days_since_epoch = ts_secs / SECS_PER_DAY;

    let mut y: i64 = 1970;
    let mut remaining = days_since_epoch as i64;

    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 0;
    for (i, &days) in month_days.iter().enumerate() {
        if remaining < days {
            m = i;
            break;
        }
        remaining -= days;
    }

    format!("{y:04}-{:02}-{:02}", m + 1, remaining + 1)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
