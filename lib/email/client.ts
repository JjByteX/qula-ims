import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set. Copy .env.example to .env first.");
}

// Reuse the client across hot reloads in dev, same pattern as db/client.ts
// and lib/storage/client.ts.
const globalForEmail = globalThis as unknown as {
  resendClient: Resend | undefined;
};

export const resend = globalForEmail.resendClient ?? new Resend(process.env.RESEND_API_KEY);

if (process.env.NODE_ENV !== "production") {
  globalForEmail.resendClient = resend;
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Qula IMS <no-reply@example.com>";
