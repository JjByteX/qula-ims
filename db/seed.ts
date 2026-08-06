import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { hashPassword } from "../lib/auth/password";

// Seed data for local dev / demo purposes. Not part of any phase's
// feature set — this just gets the two real team members into the
// database with working logins so the app doesn't have to be exercised
// through the registration + approval flow every time the DB is reset.
//
// Safe to re-run: each user is upserted by email rather than blindly
// inserted, so running this twice updates the existing row (including
// re-hashing the password to the value below) instead of erroring on
// the unique email constraint or creating a duplicate.

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

// Dev-only credential, printed to the console below. Meets
// registerSchema's 8-character minimum (lib/validation/auth.ts) — change
// it after seeding if this ever runs against anything but a local or
// throwaway environment.
const SEED_PASSWORD = "qulaims123";

type SeedUser = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: "superadmin" | "user";
};

const SEED_USERS: SeedUser[] = [
  {
    firstName: "JJ",
    middleName: "Sanchez",
    lastName: "Bassig",
    email: "jj.bassig@qula.dev",
    role: "superadmin",
  },
  {
    firstName: "Rasty",
    middleName: "Cannu",
    lastName: "Espartero",
    email: "rasty.espartero@qula.dev",
    role: "user",
  },
];

async function seedUsers() {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const seeded: { name: string; email: string; role: string }[] = [];

  for (const seedUser of SEED_USERS) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, seedUser.email))
      .limit(1);

    if (existing) {
      await db
        .update(schema.users)
        .set({
          firstName: seedUser.firstName,
          middleName: seedUser.middleName,
          lastName: seedUser.lastName,
          role: seedUser.role,
          status: "active",
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existing.id));
    } else {
      await db.insert(schema.users).values({
        firstName: seedUser.firstName,
        middleName: seedUser.middleName,
        lastName: seedUser.lastName,
        email: seedUser.email,
        passwordHash,
        role: seedUser.role,
        status: "active",
      });
    }

    seeded.push({
      name: `${seedUser.firstName} ${seedUser.middleName} ${seedUser.lastName}`,
      email: seedUser.email,
      role: seedUser.role,
    });
  }

  return seeded;
}

// Budget and app_settings are single-row tables (see db/schema/budget.ts
// and db/schema/settings.ts) that the app otherwise lazily creates with
// zero/default values on first read. Seeding them explicitly here just
// means the dashboard isn't staring at $0 the first time someone logs in.
async function seedBudget() {
  const [existing] = await db.select().from(schema.budget).limit(1);
  if (existing) return;

  await db.insert(schema.budget).values({
    allocatedFunds: "50000.00",
  });
}

async function seedAppSettings() {
  const [existing] = await db.select().from(schema.appSettings).limit(1);
  if (existing) return;

  await db.insert(schema.appSettings).values({
    notificationDaysBefore: 3,
  });
}

async function main() {
  console.log("Seeding database...");

  const seeded = await seedUsers();
  await seedBudget();
  await seedAppSettings();

  console.log("\nSeeded users:");
  for (const user of seeded) {
    console.log(`  ${user.name} (${user.role}) — ${user.email}`);
  }
  console.log(`\nPassword for both accounts: ${SEED_PASSWORD}`);
  console.log("\nSeed complete.");

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
