use crate::git::error::GitError;
use crate::git::models::{FileStatus, StatusKind, StatusReport};

use super::{split_records, splitn, text};

const RECORD_SEP: u8 = 0;

/// Parsea `git status --porcelain=v2 -z --branch --untracked-files=all`.
pub fn parse_status(data: &[u8]) -> Result<StatusReport, GitError> {
    let records = split_records(data, RECORD_SEP);
    let mut report = StatusReport::default();
    let mut index = 0;
    while index < records.len() {
        let record = records[index];
        index += 1;
        match record.first() {
            None => continue,
            Some(b'#') => parse_header(record, &mut report),
            Some(b'1') => {
                // 1 XY sub mH mI mW hH hI <path>
                let fields = splitn(record, b' ', 9);
                if fields.len() != 9 {
                    return Err(GitError::invalid(format!(
                        "entrada v2 ordinaria con {} campos",
                        fields.len()
                    )));
                }
                report.entries.push(FileStatus {
                    kind: StatusKind::Ordinary,
                    xy: text(fields[1]),
                    path: text(fields[8]),
                    orig_path: None,
                });
            }
            Some(b'2') => {
                // 2 XY sub mH mI mW hH hI Xscore <path> \0 <origPath>
                let fields = splitn(record, b' ', 10);
                if fields.len() != 10 {
                    return Err(GitError::invalid(format!(
                        "entrada v2 de rename con {} campos",
                        fields.len()
                    )));
                }
                let orig_path = records.get(index).map(|orig| text(orig));
                index += 1;
                report.entries.push(FileStatus {
                    kind: StatusKind::Renamed,
                    xy: text(fields[1]),
                    path: text(fields[9]),
                    orig_path,
                });
            }
            Some(b'u') => {
                // u XY sub m1 m2 m3 mW h1 h2 h3 <path>
                let fields = splitn(record, b' ', 11);
                if fields.len() != 11 {
                    return Err(GitError::invalid(format!(
                        "entrada v2 de conflicto con {} campos",
                        fields.len()
                    )));
                }
                report.entries.push(FileStatus {
                    kind: StatusKind::Unmerged,
                    xy: text(fields[1]),
                    path: text(fields[10]),
                    orig_path: None,
                });
            }
            Some(b'?') => {
                report.entries.push(FileStatus {
                    kind: StatusKind::Untracked,
                    xy: "?".into(),
                    path: text(record.get(2..).unwrap_or_default()),
                    orig_path: None,
                });
            }
            Some(b'!') => {
                report.entries.push(FileStatus {
                    kind: StatusKind::Ignored,
                    xy: "!".into(),
                    path: text(record.get(2..).unwrap_or_default()),
                    orig_path: None,
                });
            }
            Some(other) => {
                return Err(GitError::invalid(format!(
                    "entrada de status desconocida: {:?}",
                    *other as char
                )));
            }
        }
    }
    Ok(report)
}

fn parse_header(record: &[u8], report: &mut StatusReport) {
    let line = text(record);
    let value = line.strip_prefix("# ").unwrap_or(&line);
    if let Some(oid) = value.strip_prefix("branch.oid ") {
        report.head = if oid == "(initial)" {
            None
        } else {
            Some(oid.to_string())
        };
    } else if let Some(name) = value.strip_prefix("branch.head ") {
        if name == "(detached)" {
            report.detached = true;
            report.branch = None;
        } else {
            report.branch = Some(name.to_string());
        }
    } else if let Some(upstream) = value.strip_prefix("branch.upstream ") {
        report.upstream = Some(upstream.to_string());
    } else if let Some(ab) = value.strip_prefix("branch.ab ") {
        let mut parts = ab.split_whitespace();
        if let Some(ahead) = parts.next() {
            report.ahead = ahead.trim_start_matches('+').parse().unwrap_or(0);
        }
        if let Some(behind) = parts.next() {
            report.behind = behind.trim_start_matches('-').parse().unwrap_or(0);
        }
    }
}
