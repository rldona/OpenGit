//! Patch reconstruction for partial stage/unstage (OG-006).
//!
//! Work is done with bytes, not strings: CRLF, files without a final newline
//! and non-UTF-8 content must survive the hunk and line trimming intact.

use crate::git::error::GitError;

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum HunkSelection {
    /// Whole file (resolved with `git add`/`git restore`, not with a patch).
    File,
    /// Index of the hunk inside the patch (0-based).
    Hunk { index: usize },
    /// Global line indices inside the patch (0-based, counting headers).
    Lines { indices: Vec<usize> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LineKind {
    Context,
    Add,
    Remove,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct HunkRange {
    header: usize,
    start: usize,
    end: usize,
}

/// Parsed unified patch, keeping every line byte by byte.
#[derive(Debug, Clone)]
pub struct ParsedPatch {
    lines: Vec<Vec<u8>>,
    ends_with_newline: bool,
    hunks: Vec<HunkRange>,
}

impl ParsedPatch {
    pub fn is_empty(&self) -> bool {
        self.hunks.is_empty()
    }

    pub fn hunk_count(&self) -> usize {
        self.hunks.len()
    }

    /// Lines (global index) that represent changes, to offer a selection.
    pub fn change_lines(&self) -> Vec<usize> {
        self.lines
            .iter()
            .enumerate()
            .filter(|(_, line)| matches!(kind_of(line), LineKind::Add | LineKind::Remove))
            .map(|(index, _)| index)
            .collect()
    }

    /// Builds the patch for the selection. `None` if no change remains.
    pub fn build(&self, selection: &HunkSelection) -> Result<Option<Vec<u8>>, GitError> {
        match selection {
            HunkSelection::File => Err(GitError::invalid(
                "whole-file selection is not resolved with patches",
            )),
            HunkSelection::Hunk { index } => {
                let hunk = self.hunks.get(*index).ok_or_else(|| {
                    GitError::invalid(format!(
                        "hunk {index} out of range ({} hunks)",
                        self.hunks.len()
                    ))
                })?;
                let mut out = self.header_lines();
                out.push(self.lines[hunk.header].clone());
                out.extend(self.lines[hunk.start..hunk.end].iter().cloned());
                Ok(Some(self.render(&out)))
            }
            HunkSelection::Lines { indices } => {
                let selected: std::collections::HashSet<usize> = indices.iter().copied().collect();
                let mut out = self.header_lines();
                let mut any_change = false;

                for hunk in &self.hunks {
                    let mut hunk_lines: Vec<Vec<u8>> = vec![self.lines[hunk.header].clone()];
                    let mut has_change = false;
                    let mut previous_kept = true;

                    for line_index in hunk.start..hunk.end {
                        let line = &self.lines[line_index];
                        match kind_of(line) {
                            LineKind::Context => {
                                hunk_lines.push(line.clone());
                                previous_kept = true;
                            }
                            LineKind::Add => {
                                if selected.contains(&line_index) {
                                    hunk_lines.push(line.clone());
                                    has_change = true;
                                    previous_kept = true;
                                } else {
                                    previous_kept = false;
                                }
                            }
                            LineKind::Remove => {
                                if selected.contains(&line_index) {
                                    hunk_lines.push(line.clone());
                                    has_change = true;
                                } else {
                                    // The line still exists in the index: it becomes context.
                                    let mut context = line.clone();
                                    context[0] = b' ';
                                    hunk_lines.push(context);
                                }
                                previous_kept = true;
                            }
                            LineKind::Other => {
                                // `\ No newline` markers: only if their line remains.
                                if previous_kept {
                                    hunk_lines.push(line.clone());
                                }
                            }
                        }
                    }

                    if has_change {
                        out.extend(hunk_lines);
                        any_change = true;
                    }
                }

                if !any_change {
                    return Ok(None);
                }
                Ok(Some(self.render(&out)))
            }
        }
    }

    fn header_lines(&self) -> Vec<Vec<u8>> {
        let first_hunk = self
            .hunks
            .first()
            .map(|hunk| hunk.header)
            .unwrap_or(self.lines.len());
        self.lines[..first_hunk].to_vec()
    }

    fn render(&self, lines: &[Vec<u8>]) -> Vec<u8> {
        let mut out = Vec::new();
        for (index, line) in lines.iter().enumerate() {
            if index > 0 {
                out.push(b'\n');
            }
            out.extend_from_slice(line);
        }
        if self.ends_with_newline || !out.is_empty() {
            out.push(b'\n');
        }
        out
    }
}

pub fn parse(data: &[u8]) -> ParsedPatch {
    let mut ends_with_newline = false;
    let mut lines: Vec<Vec<u8>> = data
        .split(|byte| *byte == b'\n')
        .map(|line| line.to_vec())
        .collect();
    if lines.last().is_some_and(|line| line.is_empty()) {
        lines.pop();
        ends_with_newline = true;
    }

    let mut hunks = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        if lines[index].starts_with(b"@@") {
            let header = index;
            index += 1;
            let start = index;
            while index < lines.len()
                && !lines[index].starts_with(b"@@")
                && !lines[index].starts_with(b"diff --git ")
            {
                index += 1;
            }
            hunks.push(HunkRange {
                header,
                start,
                end: index,
            });
        } else {
            index += 1;
        }
    }

    ParsedPatch {
        lines,
        ends_with_newline,
        hunks,
    }
}

fn kind_of(line: &[u8]) -> LineKind {
    match line.first() {
        Some(b' ') => LineKind::Context,
        Some(b'+') if !line.starts_with(b"+++") => LineKind::Add,
        Some(b'-') if !line.starts_with(b"---") => LineKind::Remove,
        Some(_) => LineKind::Other,
        None => LineKind::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIFF: &[u8] = b"diff --git a/a.txt b/a.txt\nindex 111..222 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1,3 +1,3 @@\n uno\n-dos\n+DOS\n tres\n@@ -8,3 +8,3 @@\n ocho\n-nueve\n+NUEVE\n diez\n";

    #[test]
    fn parses_hunks_and_change_lines() {
        let patch = parse(DIFF);
        assert_eq!(patch.hunk_count(), 2);
        assert!(!patch.is_empty());
        let changes = patch.change_lines();
        assert_eq!(changes.len(), 4);
    }

    #[test]
    fn builds_patch_of_a_hunk() {
        let patch = parse(DIFF);
        let built = patch
            .build(&HunkSelection::Hunk { index: 0 })
            .unwrap()
            .unwrap();
        let text = String::from_utf8(built).unwrap();
        assert!(text.contains("@@ -1,3 +1,3 @@"));
        assert!(text.contains("+DOS"));
        assert!(!text.contains("NUEVE"));
        assert!(text.starts_with("diff --git"));
    }

    #[test]
    fn builds_patch_of_loose_lines() {
        let patch = parse(DIFF);
        let changes = patch.change_lines();
        let built = patch
            .build(&HunkSelection::Lines {
                indices: vec![*changes.last().unwrap()],
            })
            .unwrap()
            .unwrap();
        let text = String::from_utf8(built).unwrap();
        assert!(text.contains("+NUEVE"));
        assert!(
            text.contains(" nueve"),
            "the unselected line becomes context: {text}"
        );
        assert!(!text.contains("-nueve"));
        assert!(
            !text.contains("@@ -1,3"),
            "the hunk without changes is dropped: {text}"
        );
        assert!(text.contains("@@ -8,3 +8,3 @@"));
    }

    #[test]
    fn no_patch_when_no_changes_selected() {
        let patch = parse(DIFF);
        let context_only = patch.change_lines().is_empty();
        assert!(!context_only);
        let built = patch
            .build(&HunkSelection::Lines { indices: vec![] })
            .unwrap();
        assert!(built.is_none());
    }

    #[test]
    fn preserves_crlf_and_missing_final_newline() {
        let crlf = parse(b"--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-a\r\n+b\r\n");
        let built = crlf
            .build(&HunkSelection::Hunk { index: 0 })
            .unwrap()
            .unwrap();
        assert!(built.windows(3).any(|w| w == b"b\r\n"));

        let no_newline = parse(b"--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-sin\n\\ No newline at end of file\n+con\n\\ No newline at end of file");
        let built = no_newline
            .build(&HunkSelection::Hunk { index: 0 })
            .unwrap()
            .unwrap();
        assert!(built.ends_with(b"\n"));
        assert!(String::from_utf8(built).unwrap().contains("\\ No newline"));
    }

    #[test]
    fn hunk_out_of_range_fails() {
        let patch = parse(DIFF);
        assert!(patch.build(&HunkSelection::Hunk { index: 9 }).is_err());
    }
}
