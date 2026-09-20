/**
 * Convierte la salida de un fetch/pull/push fallido en una causa accionable.
 * Es best-effort: se apoya en los mensajes estables de git.
 */
export function describeRemoteError(lines: string[]): string | null {
  const text = lines.join("\n").toLowerCase();

  if (
    text.includes("non-fast-forward") ||
    text.includes("[rejected]") ||
    text.includes("fetch first") ||
    text.includes("failed to push some refs")
  ) {
    return "Push rejected: the remote has commits you do not have. Pull first.";
  }
  if (
    text.includes("authentication failed") ||
    text.includes("could not read username") ||
    text.includes("permission denied (publickey)") ||
    text.includes("invalid username or password") ||
    text.includes("terminal prompts disabled")
  ) {
    return "Authentication failed. Configure your credential helper or SSH key outside the app.";
  }
  if (
    text.includes("does not appear to be a git repository") ||
    text.includes("repository not found") ||
    text.includes("could not read from remote repository") ||
    text.includes("not found") ||
    text.includes("does not exist")
  ) {
    return "Remote repository not found or unreachable.";
  }
  if (text.includes("no upstream branch") || text.includes("has no upstream branch")) {
    return "This branch has no upstream. Push again with Set upstream.";
  }
  if (text.includes("couldn't find remote ref") || text.includes("could not find remote ref")) {
    return "The remote ref does not exist.";
  }
  return null;
}
