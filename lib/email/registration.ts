import { resend, EMAIL_FROM } from "./client";

// Links straight to the pending-requests list (superadmin only, phases-plan
// 1.5), same reasoning as password-reset.ts's buildResetUrl — the email
// should take the reader directly to the action, not just the app root.
function buildPendingRequestsUrl(): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/users/pending`;
}

export async function sendNewRegistrationEmail(params: {
  to: string;
  applicantName: string;
}): Promise<void> {
  await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: "New account request on Qula IMS",
    html: `
      <p>${params.applicantName} just requested an account on Qula IMS.</p>
      <p><a href="${buildPendingRequestsUrl()}">Review pending requests</a></p>
    `,
  });
}
