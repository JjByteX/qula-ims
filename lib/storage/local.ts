import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

// Local-disk storage driver, used automatically when R2 isn't configured
// (see hasR2Config in ./client). Lets the app run fully locally with zero
// storage setup — no Cloudflare account needed just to try uploading a
// profile picture. Not meant for production: files live under
// public/uploads, which most hosts (including a typical Next.js
// deployment) don't persist or share across instances/deploys the way a
// real object store does. R2 remains the production path; this only
// exists so local dev isn't blocked on having R2 credentials.
//
// Writes under public/ specifically because Next.js serves that
// directory's contents as static assets automatically, at a URL path
// matching the file's path on disk — so a file written to
// public/uploads/profile-pictures/<id>/<uuid>.jpg is reachable at
// /uploads/profile-pictures/<id>/<uuid>.jpg with no extra route needed,
// same shape as an R2 object being reachable at
// https://<hostname>/profile-pictures/<id>/<uuid>.jpg.

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export async function putObjectLocal(key: string, body: Buffer): Promise<void> {
  const filePath = path.join(UPLOADS_ROOT, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

export async function deleteFileLocal(key: string): Promise<void> {
  const filePath = path.join(UPLOADS_ROOT, key);
  // Best-effort, same as the R2 delete path (lib/storage/upload.ts's
  // callers already .catch(() => {}) around deleteFile) — a file that's
  // already gone, or a permissions hiccup, shouldn't block whatever
  // caller is cleaning up after itself.
  await unlink(filePath).catch(() => {});
}

export function getPublicUrlLocal(key: string): string {
  // Relative, not absolute — unlike R2's getPublicUrl (which must return
  // a full https://... URL since the bucket is a different host), the
  // local files are served by this same Next.js app, so a root-relative
  // path is simpler and works regardless of what host/port dev is
  // running on.
  return `/uploads/${key}`;
}
