import { randomUUID } from "crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "./client";

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

// --- Invoice QR code image ----------------------------------------------
// The QR code on a generated invoice is a person's own upload (e.g. an
// InstaPay QR screenshot), not something the app generates — same 2MB
// image-upload shape as profile pictures, just a different storage
// prefix and no association with a user.

const MAX_QR_CODE_BYTES = 2 * 1024 * 1024;

const QR_CODE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadInvoiceQrCode(params: {
  documentId: string;
  file: File;
}): Promise<UploadResult> {
  const { documentId, file } = params;

  const extension = QR_CODE_TYPES[file.type];
  if (!extension) {
    throw new StorageValidationError(
      `Unsupported image type "${file.type}". Allowed: JPEG, PNG, WebP.`,
    );
  }
  if (file.size > MAX_QR_CODE_BYTES) {
    throw new StorageValidationError("QR code image exceeds the 2MB limit.");
  }

  const key = `project-documents/${documentId}/qr-code/${randomUUID()}.${extension}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { key, url: getPublicUrl(key) };
}

// --- Shared helpers -----------------------------------------------------

async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2Client.send(
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
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

export function getPublicUrl(key: string): string {
  const hostname = process.env.R2_PUBLIC_HOSTNAME;
  if (!hostname) {
    throw new Error("R2_PUBLIC_HOSTNAME is not set. Copy .env.example to .env first.");
  }
  return `https://${hostname}/${key}`;
}
