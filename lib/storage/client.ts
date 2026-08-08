import { S3Client } from "@aws-sdk/client-s3";

const requiredEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_HOSTNAME",
] as const;

// Whether R2 is actually configured. Used by lib/storage/upload.ts to
// choose between the real R2 driver and the local-disk fallback
// (lib/storage/local.ts) — no separate on/off switch to set by hand, R2
// is used automatically the moment all five vars are present, local disk
// otherwise. This used to be an unconditional throw-if-missing check,
// which meant every route that imports anything from @/lib/storage
// failed at import time without R2 configured, even for requests that
// never touched a file (e.g. saving a profile's name). Local dev
// shouldn't require a Cloudflare account just to run the app.
export const hasR2Config = requiredEnv.every((key) => Boolean(process.env[key]));

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "";

// Reuse the client across hot reloads in dev, same pattern as db/client.ts.
// Only constructed when R2 is actually configured — building an S3Client
// with empty-string credentials wouldn't throw here, only later when
// something actually tries to use it, which is a worse failure mode than
// just not constructing it at all.
const globalForStorage = globalThis as unknown as {
  r2Client: S3Client | undefined;
};

export const r2Client = hasR2Config
  ? (globalForStorage.r2Client ??
    new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    }))
  : undefined;

if (hasR2Config && process.env.NODE_ENV !== "production") {
  globalForStorage.r2Client = r2Client;
}
