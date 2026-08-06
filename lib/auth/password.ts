import { Argon2id } from "oslo/password";

// Argon2id is oslo's/OWASP's recommended default; its constructor already
// uses recommended parameters, so no manual tuning is needed here.
const hasher = new Argon2id();

export function hashPassword(password: string): Promise<string> {
  return hasher.hash(password);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return hasher.verify(hash, password);
}
