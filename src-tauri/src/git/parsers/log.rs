use crate::git::error::GitError;
use crate::git::models::Commit;

use super::{split_records, splitn, text};

const FIELD_SEP: u8 = 0x1f;
const RECORD_SEP: u8 = 0;
const EXPECTED_FIELDS: usize = 8;

/// Parses `git log -z --format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s%x1f%b`.
///
/// The body (`%b`) goes last on purpose: it can contain line breaks and,
/// in theory, the field separator itself, so it is split with `splitn` and
/// everything left over stays in the body instead of breaking the record.
pub fn parse_log(data: &[u8]) -> Result<Vec<Commit>, GitError> {
    let mut commits = Vec::new();
    for record in split_records(data, RECORD_SEP) {
        if record.is_empty() {
            continue;
        }
        let fields = splitn(record, FIELD_SEP, EXPECTED_FIELDS);
        if fields.len() != EXPECTED_FIELDS {
            return Err(GitError::invalid(format!(
                "log record with {} fields, expected {EXPECTED_FIELDS}",
                fields.len()
            )));
        }
        let author_time = text(fields[4]).parse::<i64>().map_err(|_| {
            GitError::invalid(format!(
                "unreadable commit timestamp: {:?}",
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
            // git closes `%b` with leftover line breaks; an empty body
            // must remain an empty string, not "\n\n".
            body: text(fields[7]).trim_end().to_owned(),
        });
    }
    Ok(commits)
}
