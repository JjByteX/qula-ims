import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordResetTokens } from "@/db/schema";

// Reset links carry the raw token; only its hash is stored (schema:
// passwordResetTokens.tokenHash), same reasoning as password hashing —
// a DB read alone should never be enough to issue a valid reset link.
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Creates a single-use, expiring token row and returns the raw token to
// embed in the emailed link. Any previous unused tokens for this user are
// left in place — they'll simply fail to match once a new one is used, and
// all expire on their own schedule.
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  return rawToken;
}

type TokenCheckResult =
  | { valid: true; userId: string; tokenId: string }
  | { valid: false };

// Looks up a raw token by its hash. Does not consume it — call
// consumePasswordResetToken once the new password has actually been set.
export async function verifyPasswordResetToken(rawToken: string): Promise<TokenCheckResult> {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, hashToken(rawToken)))
    .limit(1);

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return { valid: false };
  }

  return { valid: true, userId: row.userId, tokenId: row.id };
}

export async function consumePasswordResetToken(tokenId: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenId));
}
