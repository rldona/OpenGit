use crate::git::error::GitError;
use crate::git::models::Stash;

use super::{split_fields, split_records, text};

const RECORD_SEP: u8 = 0;
const FIELD_SEP: u8 = 0x1f;
const EXPECTED_FIELDS: usize = 4;

/// Parses `git stash list -z --format=%gd%x1f%gs%x1f%ct%x1f%H`.
pub fn parse_stash_list(data: &[u8]) -> Result<Vec<Stash>, GitError> {
    let mut stashes = Vec::new();
    for record in split_records(data, RECORD_SEP) {
        if record.is_empty() {
            continue;
        }
        let fields = split_fields(record, FIELD_SEP);
        if fields.len() != EXPECTED_FIELDS {
            return Err(GitError::invalid(format!(
                "stash record with {} fields, expected {EXPECTED_FIELDS}",
                fields.len()
            )));
        }
        let timestamp = text(fields[2]).parse::<i64>().map_err(|_| {
            GitError::invalid(format!("unreadable stash timestamp: {:?}", text(fields[2])))
        })?;
        stashes.push(Stash {
            reference: text(fields[0]),
            subject: text(fields[1]),
            timestamp,
            hash: text(fields[3]),
        });
    }
    Ok(stashes)
}
