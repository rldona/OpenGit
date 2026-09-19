use crate::git::error::GitError;
use crate::git::models::BlameLine;

/// Parses `git blame --line-porcelain -M` (OG-055).
///
/// With `--line-porcelain` each blamed line repeats the full commit header, so
/// a record is: `<sha> <orig-line> <final-line> [<num-lines>]`, metadata lines
/// (`author`, `author-mail`, `author-time`, …) and a tab-prefixed content line.
/// Boundary commits prefix the hash with `^`; uncommitted lines use all zeros.
pub fn parse_blame(data: &[u8]) -> Result<Vec<BlameLine>, GitError> {
    let text = String::from_utf8_lossy(data);
    let mut lines = Vec::new();
    let mut current: Option<BlameLine> = None;

    for raw in text.split('\n') {
        let raw = raw.strip_suffix('\r').unwrap_or(raw);

        if let Some(content) = raw.strip_prefix('\t') {
            if let Some(mut line) = current.take() {
                line.content = content.to_string();
                lines.push(line);
            }
            continue;
        }
        if raw.is_empty() {
            continue;
        }

        let parts: Vec<&str> = raw.split(' ').collect();
        let hash = parts[0].trim_start_matches('^');
        let is_header = parts.len() >= 3
            && hash.len() == 40
            && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
            && parts[1].parse::<u32>().is_ok();

        if is_header {
            current = Some(BlameLine {
                line: parts[2].parse().unwrap_or(0),
                hash: hash.to_string(),
                author_name: String::new(),
                author_email: String::new(),
                author_time: 0,
                content: String::new(),
            });
            continue;
        }

        if let Some(line) = current.as_mut() {
            if let Some(value) = raw.strip_prefix("author-mail ") {
                line.author_email = value.trim_matches(|c| c == '<' || c == '>').to_string();
            } else if let Some(value) = raw.strip_prefix("author-time ") {
                line.author_time = value.trim().parse().unwrap_or(0);
            } else if let Some(value) = raw.strip_prefix("author ") {
                line.author_name = value.to_string();
            }
        }
    }

    Ok(lines)
}
