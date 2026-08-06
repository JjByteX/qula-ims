import { S3Client } from "@aws-sdk/client-s3";

const requiredEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} is not set. Copy .env.example to .env first.`);
  }
}

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Reuse the client across hot reloads in dev, same pattern as db/client.ts.
const globalForStorage = globalThis as unknown as {
  r2Client: S3Client | undefined;
};

export const r2Client =
  globalForStorage.r2Client ??
  new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForStorage.r2Client = r2Client;
}
