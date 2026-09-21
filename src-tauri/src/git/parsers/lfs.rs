use super::text;

/// Filters a `git ls-files -z` leaving only the `.gitattributes`.
pub fn parse_gitattributes_paths(data: &[u8]) -> Vec<String> {
    data.split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .map(text)
        .filter(|path| path.rsplit('/').next() == Some(".gitattributes"))
        .collect()
}

/// Does any active line of `.gitattributes` use `filter=lfs`?
pub fn parse_gitattributes_uses_lfs(data: &[u8]) -> bool {
    text(data).lines().any(|line| {
        let line = line.trim();
        !line.starts_with('#') && line.split_whitespace().any(|token| token == "filter=lfs")
    })
}

/// Active `filter=lfs` patterns of a `.gitattributes` file, in order.
///
/// Comments and macro definitions (`[attr]…`) are ignored and quoted patterns
/// are unquoted. The caller prefixes each pattern with its file's directory.
pub fn parse_lfs_patterns(data: &[u8]) -> Vec<String> {
    text(data)
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with('[') {
                return None;
            }
            let (pattern, attributes) = split_pattern(line)?;
            attributes
                .split_whitespace()
                .any(|token| token == "filter=lfs")
                .then_some(pattern)
        })
        .collect()
}

/// Splits the first field (the pattern) from the attributes, honouring quotes.
fn split_pattern(line: &str) -> Option<(String, &str)> {
    if let Some(rest) = line.strip_prefix('"') {
        let mut escaped = false;
        for (index, character) in rest.char_indices() {
            match character {
                '\\' if !escaped => escaped = true,
                '"' if !escaped => {
                    let pattern = rest[..index].replace("\\\"", "\"").replace("\\\\", "\\");
                    return Some((pattern, &rest[index + 1..]));
                }
                _ => escaped = false,
            }
        }
        return None;
    }
    let end = line.find(char::is_whitespace)?;
    Some((line[..end].to_string(), &line[end..]))
}
