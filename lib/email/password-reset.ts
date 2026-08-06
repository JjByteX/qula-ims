import { resend, EMAIL_FROM } from "./client";

// APP_URL builds the link the user clicks; required per .env.example.
function buildResetUrl(rawToken: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/reset-password?token=${rawToken}`;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  firstName: string;
  rawToken: string;
}): Promise<void> {
  const resetUrl = buildResetUrl(params.rawToken);

  await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: "Reset your Qula IMS password",
    html: `
      <p>Hi ${params.firstName},</p>
      <p>We received a request to reset your Qula IMS password. This link is valid for 1 hour and can only be used once.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
    `,
  });
}
