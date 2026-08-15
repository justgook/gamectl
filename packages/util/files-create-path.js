export function planCreateEntry(rawName, requestedKind) {
  const name = String(rawName).trim()

  if (!name) {
    throw new Error(
      `${requestedKind === "directory" ? "Folder" : "File"} name is required`,
    )
  }
  if (name.startsWith("/")) {
    throw new Error("Path must be relative")
  }

  const kind =
    requestedKind === "directory" || name.endsWith("/")
      ? "directory"
      : "regular-file"
  const relativePath = name.endsWith("/") ? name.slice(0, -1) : name
  const segments = relativePath.split("/")

  if (segments.some((segment) => segment.length === 0)) {
    throw new Error("Path must not contain empty segments")
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Reserved path segment is not allowed")
  }

  return {
    kind,
    relativePath: segments.join("/"),
    directorySegments:
      kind === "directory" ? segments : segments.slice(0, -1),
  }
}
