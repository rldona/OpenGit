use crate::git::error::GitError;
use crate::git::models::Commit;

use super::{split_fields, split_records, text};

const FIELD_SEP: u8 = 0x1f;
const RECORD_SEP: u8 = 0;
const EXPECTED_FIELDS: usize = 7;

/// Parsea `git log -z --format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s`.
pub fn parse_log(data: &[u8]) -> Result<Vec<Commit>, GitError> {
    let mut commits = Vec::new();
    for record in split_records(data, RECORD_SEP) {
        if record.is_empty() {
            continue;
        }
        let fields = split_fields(record, FIELD_SEP);
        if fields.len() != EXPECTED_FIELDS {
            return Err(GitError::invalid(format!(
                "registro de log con {} campos, se esperaban {EXPECTED_FIELDS}",
                fields.len()
            )));
        }
        let author_time = text(fields[4]).parse::<i64>().map_err(|_| {
            GitError::invalid(format!(
                "timestamp de commit ilegible: {:?}",
                text(fields[4])
            ))
        })?;
        commits.push(Commit {
            hash: text(fields[0]),
            parents: text(fields[1])
                .split(' ')
                .filter(|parent| !parent.is_empty())
                .map(str::to_owned)
                .collect(),
            author_name: text(fields[2]),
            author_email: text(fields[3]),
            author_time,
            refs: text(fields[5])
                .split(", ")
                .filter(|reference| !reference.is_empty())
                .map(str::to_owned)
                .collect(),
            subject: text(fields[6]),
        });
    }
    Ok(commits)
}
