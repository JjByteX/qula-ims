// Used by every "edited" activity log entry that lists which fields
// changed (project.edited, user.edited, invoice.edited, ar.edited).
// Object.keys(parsed.data) used to be logged directly, but a full
// (non-.partial()) Zod schema means parsed.data always has every field
// the schema defines, whether or not the person actually touched it in
// the form — so the log always listed every editable field on every
// save, no matter how small the real change was. This compares the
// value actually being written against the value the row had before the
// update, and only returns keys where those two differ.
//
// Values are normalized before comparing so an unset optional field
// (stored as null, or absent as undefined, or submitted as an empty
// string depending on which layer touched it last) doesn't register as
// a change against another equally-unset representation of the same
// nothing.
function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

export function diffFields<T extends Record<string, unknown>>(
  before: Record<string, unknown>,
  after: T,
): (keyof T)[] {
  return (Object.keys(after) as (keyof T)[]).filter(
    (key) => normalize(before[key as string]) !== normalize(after[key]),
  );
}
