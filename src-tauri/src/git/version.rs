use std::fmt;

use serde::Serialize;

use super::error::GitError;

/// Minimum supported version (ADR-0003).
pub const MINIMUM_GIT_VERSION: GitVersion = GitVersion {
    major: 2,
    minor: 34,
    patch: 0,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct GitVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl GitVersion {
    /// Parses the output of `git --version`, e.g. `git version 2.50.1 (Apple Git-155)`.
    pub fn parse(output: &str) -> Result<Self, GitError> {
        let rest = output
            .trim()
            .strip_prefix("git version ")
            .ok_or_else(|| GitError::invalid(format!("unexpected version output: {output:?}")))?;
        let numbers = rest.split_whitespace().next().unwrap_or_default();
        let mut parts = numbers.split('.');
        let major = parse_part(parts.next(), output)?;
        let minor = parse_part(parts.next(), output)?;
        let patch = parts
            .next()
            .map(|p| parse_part(Some(p), output))
            .transpose()?
            .unwrap_or(0);
        Ok(Self {
            major,
            minor,
            patch,
        })
    }

    pub fn meets_minimum(&self) -> bool {
        *self >= MINIMUM_GIT_VERSION
    }
}

fn parse_part(part: Option<&str>, output: &str) -> Result<u32, GitError> {
    part.and_then(|value| value.parse().ok())
        .ok_or_else(|| GitError::invalid(format!("unreadable git version: {output:?}")))
}

impl fmt::Display for GitVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}
