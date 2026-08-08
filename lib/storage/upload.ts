import { randomUUID } from "crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, hasR2Config } from "./client";
import { putObjectLocal, deleteFileLocal, getPublicUrlLocal } from "./local";

// Thrown for bad input (wrong type, too large) so callers can turn it into
// a 400 response. Anything else (network, credentials) is a real failure
// and should surface as a 500 instead.
export class StorageValidationError extends Error {}

export interface UploadResult {
  key: string;
  url: string;
}

// --- Profile pictures ------------------------------------------------
// 2MB limit and allowed types per Client-Requests.md / phases-plan.md 0.4.
// Enforced here, not just client-side, so a direct API call can't bypass it.

const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

const PROFILE_PICTURE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadProfilePicture(params: {
  userId: string;
  file: File;
}): Promise<UploadResult> {
  const { userId, file } = params;

  const extension = PROFILE_PICTURE_TYPES[file.type];
  if (!extension) {
    throw new StorageValidationError(
      `Unsupported image type "${file.type}". Allowed: JPEG, PNG, WebP.`,
    );
  }
  if (file.size > MAX_PROFILE_PICTURE_BYTES) {
    throw new StorageValidationError("Profile picture exceeds the 2MB limit.");
  }

  const key = `profile-pictures/${userId}/${randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { key, url: getPublicUrl(key) };
}

// --- Invoice / Acknowledgement Receipt documents ----------------------
// Docs and PDF only, per Client-Requests.md. No size limit was specified
// for these, but an unbounded upload is still a cost/DoS risk, so a
// generous cap is enforced rather than none at all.

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function uploadProjectDocument(params: {
  projectId: string;
  type: "invoice" | "ar";
  file: File;
}): Promise<UploadResult> {
  const { projectId, type, file } = params;

  const extension = DOCUMENT_TYPES[file.type];
  if (!extension) {
    throw new StorageValidationError(
      `Unsupported file type "${file.type}". Allowed: PDF, DOC, DOCX.`,
    );
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new StorageValidationError("File exceeds the 20MB limit.");
  }

  const key = `project-documents/${projectId}/${type}/${randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { key, url: getPublicUrl(key) };
}

// --- User payment profile: QR code + signature ---------------------------
// A user's own payment QR code and signature image (docs/phases-plan-
// revision-1.md Phase 12.2), used once they become the designated payer.
// This is now the only place a QR code image is ever uploaded — the old
// per-invoice QR upload (uploadInvoiceQrCode) was removed in
// docs/phases-plan-revision-2.md Phase 15: a new invoice's QR code is
// snapshotted automatically from here instead
// (app/api/projects/[id]/documents/route.ts), the same way the signature
// already was.

const MAX_PAYMENT_QR_CODE_BYTES = 2 * 1024 * 1024;

const PAYMENT_QR_CODE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadPaymentQrCode(params: {
  userId: string;
  file: File;
}): Promise<UploadResult> {
  const { userId, file } = params;

  const extension = PAYMENT_QR_CODE_TYPES[file.type];
  if (!extension) {
    throw new StorageValidationError(
      `Unsupported image type "${file.type}". Allowed: JPEG, PNG, WebP.`,
    );
  }
  if (file.size > MAX_PAYMENT_QR_CODE_BYTES) {
    throw new StorageValidationError("QR code image exceeds the 2MB limit.");
  }

  const key = `users/${userId}/payment-qr-code/${randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { key, url: getPublicUrl(key) };
}

const MAX_PAYMENT_SIGNATURE_BYTES = 2 * 1024 * 1024;

const PAYMENT_SIGNATURE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadPaymentSignature(params: {
  userId: string;
  file: File;
}): Promise<UploadResult> {
  const { userId, file } = params;

  const extension = PAYMENT_SIGNATURE_TYPES[file.type];
  if (!extension) {
    throw new StorageValidationError(
      `Unsupported image type "${file.type}". Allowed: JPEG, PNG, WebP.`,
    );
  }
  if (file.size > MAX_PAYMENT_SIGNATURE_BYTES) {
    throw new StorageValidationError("Signature image exceeds the 2MB limit.");
  }

  const key = `users/${userId}/payment-signature/${randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { key, url: getPublicUrl(key) };
}

// --- Shared helpers -----------------------------------------------------
// Both drivers (R2 and local-disk) implement the same three operations;
// which one runs is decided once, here, by hasR2Config — every upload
// function above calls these without knowing or caring which driver is
// actually behind them.

async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!hasR2Config) {
    await putObjectLocal(key, body);
    return;
  }
  await r2Client!.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Removes a stored file, e.g. an old profile picture being replaced.
export async function deleteFile(key: string): Promise<void> {
  if (!hasR2Config) {
    await deleteFileLocal(key);
    return;
  }
  await r2Client!.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

export function getPublicUrl(key: string): string {
  if (!hasR2Config) {
    return getPublicUrlLocal(key);
  }
  // hasR2Config already confirmed R2_PUBLIC_HOSTNAME is set (client.ts's
  // requiredEnv includes it), so this is always defined on this branch.
  return `https://${process.env.R2_PUBLIC_HOSTNAME}/${key}`;
}
