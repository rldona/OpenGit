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
