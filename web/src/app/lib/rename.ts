// Renaming a run (contracts §11.1): name rules, server errors as one-line
// messages, and re-keying everything the app holds by run name. Pure, so the
// node tests can import it.

/** What the server accepts (`manifest.validate_run_name`). */
export const RUN_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const MSG_CHARS = "Use letters, digits, . _ and - only";
export const MSG_START = "Start with a letter or digit";
export const MSG_LONG = "Use at most 128 characters";
export const MSG_EXISTS = "A run with that name already exists";
export const MSG_RECORDING = "Finish recording before renaming";

/** A one-line reason the name cannot be used, or null when it is valid. */
export function validateRunName(name: string): string | null {
  if (RUN_NAME_RE.test(name)) return null;
  if (name.length > 128) return MSG_LONG;
  if (!/^[A-Za-z0-9._-]*$/.test(name)) return MSG_CHARS;
  return MSG_START;
}

/** A failed rename request; `status` is the HTTP status. */
export class RenameError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The inline message for a failed rename. 409 is "exists" or "still
 * recording", told apart by the server's wording (it says "recording").
 */
export function renameMessage(status: number, serverMessage: string): string {
  switch (status) {
    case 400:
      return MSG_CHARS;
    case 404:
      return "This run no longer exists";
    case 409:
      return /record/i.test(serverMessage) ? MSG_RECORDING : MSG_EXISTS;
    case 403:
      return "This library is read-only";
    default:
      return serverMessage || "Could not rename the run";
  }
}

/** The list with every entry named `from` renamed to `to`. */
export function renameIn<T extends { name: string }>(list: T[], from: string, to: string): T[] {
  return list.some((x) => x.name === from) ? list.map((x) => (x.name === from ? { ...x, name: to } : x)) : list;
}

/** The record with the key `from` moved to `to`. */
export function renameKey<V>(rec: Record<string, V>, from: string, to: string): Record<string, V> {
  if (!(from in rec)) return rec;
  const { [from]: v, ...rest } = rec;
  return { ...rest, [to]: v };
}
