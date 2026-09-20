use super::text;

/// Filtra un `git ls-files -z` dejando solo los `.gitattributes`.
pub fn parse_gitattributes_paths(data: &[u8]) -> Vec<String> {
    data.split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .map(text)
        .filter(|path| path.rsplit('/').next() == Some(".gitattributes"))
        .collect()
}

/// ¿Alguna línea activa del `.gitattributes` usa `filter=lfs`?
pub fn parse_gitattributes_uses_lfs(data: &[u8]) -> bool {
    text(data).lines().any(|line| {
        let line = line.trim();
        !line.starts_with('#') && line.split_whitespace().any(|token| token == "filter=lfs")
    })
}
