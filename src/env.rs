use anyhow::{Context, Result};
use std::fs::File;
use std::io::{BufRead, BufReader};

/// Parse a dotenv file and return values for the given key names.
pub fn parse_env_file(path: &str, id_key: &str, secret_key: &str) -> Result<(String, String)> {
    let file = File::open(path).with_context(|| format!("failed to open env file: {path}"))?;
    let reader = BufReader::new(file);

    let mut id_value: Option<String> = None;
    let mut secret_value: Option<String> = None;

    for line in reader.lines() {
        let line = line.with_context(|| format!("failed to read env file: {path}"))?;
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim().trim_matches('"').trim_matches('\'');
        if key == id_key {
            id_value = Some(value.to_string());
        } else if key == secret_key {
            secret_value = Some(value.to_string());
        }
    }

    let id = id_value.with_context(|| format!("missing key `{id_key}` in env file: {path}"))?;
    let secret =
        secret_value.with_context(|| format!("missing key `{secret_key}` in env file: {path}"))?;
    Ok((id, secret))
}
