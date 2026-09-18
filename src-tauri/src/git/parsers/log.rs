use crate::git::error::GitError;
use crate::git::models::Commit;

use super::{split_records, splitn, text};

const FIELD_SEP: u8 = 0x1f;
const RECORD_SEP: u8 = 0;
const EXPECTED_FIELDS: usize = 8;

/// Parsea `git log -z --format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s%x1f%b`.
///
/// El cuerpo (`%b`) va el último a propósito: puede contener saltos de línea y,
/// en teoría, el propio separador de campos, así que se trocea con `splitn` y
/// todo lo que sobra se queda en el cuerpo en vez de romper el registro.
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
            // git cierra `%b` con saltos de línea sobrantes; el cuerpo vacío
            // debe quedar como cadena vacía, no como "\n\n".
            body: text(fields[7]).trim_end().to_owned(),
        });
    }
    Ok(commits)
}
