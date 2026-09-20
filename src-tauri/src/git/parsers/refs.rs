use crate::git::error::GitError;
use crate::git::models::Ref;

use super::{split_fields, split_records, text};

const RECORD_SEP: u8 = b'\n';
const FIELD_SEP: u8 = 0;
const EXPECTED_FIELDS: usize = 5;

/// Parsea `git for-each-ref --format=%refname%00%objectname%00%objecttype%00%upstream%00%upstream:track`.
pub fn parse_refs(data: &[u8]) -> Result<Vec<Ref>, GitError> {
    let mut refs = Vec::new();
    for record in split_records(data, RECORD_SEP) {
        if record.is_empty() {
            continue;
        }
        let fields = split_fields(record, FIELD_SEP);
        if fields.len() != EXPECTED_FIELDS {
            return Err(GitError::invalid(format!(
                "ref record with {} fields, expected {EXPECTED_FIELDS}",
                fields.len()
            )));
        }
        refs.push(Ref {
            name: text(fields[0]),
            object_id: text(fields[1]),
            object_type: text(fields[2]),
            upstream: non_empty(fields[3]),
            track: non_empty(fields[4]),
        });
    }
    Ok(refs)
}

fn non_empty(field: &[u8]) -> Option<String> {
    let value = text(field);
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}
