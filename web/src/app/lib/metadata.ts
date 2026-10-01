// Display values for the Metadata table, as pure functions (node --test).

/** The last path segment, for a Unix or Windows path; the whole text when there is no separator. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

/** `[14, 7]` for a shaped stream, `scalar` otherwise, then the unit. */
export function streamSummary(shape: readonly number[], units?: string): string {
  const base = shape.length ? `[${shape.join(", ")}]` : "scalar";
  return units ? `${base} ${units}` : base;
}
