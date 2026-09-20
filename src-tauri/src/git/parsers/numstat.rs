use crate::git::error::GitError;
use crate::git::models::FileDiff;

use super::{split_fields, split_records, text};

const RECORD_SEP: u8 = 0;
const FIELD_SEP: u8 = b'\t';

/// Parsea `git diff --numstat -z -M`.
///
/// Un rename en modo `-z` llega como `A\tD\t\0<old>\0<new>`: el primer token
/// trae los contadores y la ruta vacía, y las dos rutas van en tokens aparte.
pub fn parse_numstat(data: &[u8]) -> Result<Vec<FileDiff>, GitError> {
    let tokens = split_records(data, RECORD_SEP);
    let mut diffs = Vec::new();
    let mut index = 0;
    while index < tokens.len() {
        let token = tokens[index];
        let fields = split_fields(token, FIELD_SEP);
        if fields.len() != 3 {
            return Err(GitError::invalid(format!(
                "entrada numstat con {} campos, se esperaban 3",
                fields.len()
            )));
        }
        let added = parse_count(fields[0])?;
        let deleted = parse_count(fields[1])?;
        let binary = fields[0] == b"-";
        let path = text(fields[2]);

        if path.is_empty() {
            let orig = tokens.get(index + 1).map(|token| text(token));
            let new = tokens.get(index + 2).map(|token| text(token));
            index += 3;
            let (Some(orig), Some(new)) = (orig, new) else {
                return Err(GitError::invalid("rename numstat sin las dos rutas"));
            };
            diffs.push(FileDiff {
                path: new,
                orig_path: Some(orig),
                binary,
                added,
                deleted,
            });
        } else {
            index += 1;
            diffs.push(FileDiff {
                path,
                orig_path: None,
                binary,
                added,
                deleted,
            });
        }
    }
    Ok(diffs)
}

fn parse_count(field: &[u8]) -> Result<Option<u64>, GitError> {
    if field == b"-" {
        return Ok(None);
    }
    text(field)
        .parse::<u64>()
        .map(Some)
        .map_err(|_| GitError::invalid(format!("contador numstat ilegible: {:?}", text(field))))
}
