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
  // Payment profile (docs/phases-plan-revision-1.md Phase 12). Method/
  // Account Name/Bank are the same for both seeded users (shared
  // InstaPay/MariBank details), so seeding them here means a fresh dev
  // DB doesn't need each field retyped by hand in Settings before a
  // designated payer can be picked. Account number and QR code are
  // deliberately left unset — those are uploaded by hand per person,
  // not shared/guessable values a seed script should invent.
  paymentMethod: string;
  paymentAccountName: string;
  paymentBank: string;
};

const SEED_USERS: SeedUser[] = [
  {
    firstName: "JJ",
    middleName: "Sanchez",
    lastName: "Bassig",
    email: "jj.bassig@qula.dev",
    role: "superadmin",
    paymentMethod: "InstaPay",
    paymentAccountName: "Jj Bassig",
    paymentBank: "MariBank",
  },
  {
    firstName: "Rasty",
    middleName: "Cannu",
    lastName: "Espartero",
    email: "rasty.espartero@qula.dev",
    role: "user",
    paymentMethod: "InstaPay",
    paymentAccountName: "Rasty Espartero",
    paymentBank: "MariBank",
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
          paymentMethod: seedUser.paymentMethod,
          paymentAccountName: seedUser.paymentAccountName,
          paymentBank: seedUser.paymentBank,
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
        paymentMethod: seedUser.paymentMethod,
        paymentAccountName: seedUser.paymentAccountName,
        paymentBank: seedUser.paymentBank,
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
    allocatedFunds: "175.00",
  });
}

// Reserve is carved out of the milestone income for a specific purpose
// (see lib/budget/compute.ts's chained-pots comment) — Telegram Premium
// is that purpose for the seeded FnB data, fully spending the 175.00
// reserve so its remaining balance nets to 0 while the split pool math
// can be checked against a known example.
//
// Upserted by description, same reasoning as the other seed rows: safe
// to run this file again without creating a duplicate expense.
async function seedExpenses() {
  const [superadmin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, SEED_USERS[0].email))
    .limit(1);
  if (!superadmin) {
    throw new Error(`Seed user ${SEED_USERS[0].email} not found — run seedUsers() first.`);
  }

  const [existing] = await db
    .select({ id: schema.expenses.id })
    .from(schema.expenses)
    .where(eq(schema.expenses.description, "Telegram Premium"))
    .limit(1);
  if (existing) return;

  await db.insert(schema.expenses).values({
    amount: "175.00",
    description: "Telegram Premium",
    date: "2026-06-25",
    createdByUserId: superadmin.id,
  });
}

async function seedAppSettings() {
  const [existing] = await db.select().from(schema.appSettings).limit(1);
  if (existing) return;

  // No notificationDaysBefore anymore (docs/phases-plan-revision-2.md
  // Phase 20 removed it) and designatedPayerUserId is nullable with no
  // default to seed — this just ensures the single settings row exists,
  // same as getOrCreateAppSettings() would do lazily on first access.
  await db.insert(schema.appSettings).values({});
}

// Demo project matching the actual client proposal ("Bar and Kitchen
// Inventory Management System", Liquor Inventory Solution / Lourd
// Borromeo) — real milestone names and prices from that document's
// payment breakdown, so the dashboard and project pages have realistic
// multi-milestone data to look at instead of empty states.
//
// Upserted by project title, same reasoning as seedUsers: safe to run
// this file again without creating a duplicate project or duplicate
// milestones. Milestones are matched by (projectId, title) — if this
// runs again after someone has since renamed a seeded milestone, it
// would create a second one rather than silently overwrite their edit,
// which is the safer failure mode for a dev-only script.
const FNB_PROJECT_TITLE = "Bar and Kitchen Inventory Management System";

type SeedMilestone = {
  title: string;
  price: string;
  status: "pending" | "completed";
  // ISO date string ("YYYY-MM-DD"), only meaningful when status is
  // "completed" — matches the real AR issue date for the two paid
  // milestones below rather than defaulting to whenever the seed script
  // happens to run.
  completedAt?: string;
};

const FNB_MILESTONES: SeedMilestone[] = [
  {
    title: "Project Mobilization and Initial Development",
    price: "20000.00",
    status: "completed",
    // Matches AR-2026-001's real issue date (FNB_PAID_MILESTONES below)
    // — a milestone can't be marked completed after its AR was already
    // issued for it, so this is the same date, not "whenever the seed
    // script happens to run" (new Date()).
    completedAt: "2026-06-26",
  },
  {
    title: "Core Features Completion",
    price: "15000.00",
    status: "completed",
    completedAt: "2026-06-25",
  },
  { title: "Final Deployment and Project Completion", price: "15000.00", status: "pending" },
  {
    title: "Development Resources, Infrastructure, and Third-Party Services",
    price: "4000.00",
    status: "pending",
  },
];

// For the 2 completed milestones, matching a paid invoice + AR each —
// numbers, dates, and amount-in-words specific to each milestone's price.
// arDocumentDate is separate from the invoice's documentDate below (both
// used to share one hardcoded "2026-06-25") since the real AR-2026-001
// document was actually issued the next day, June 26 — the invoice date
// stays June 25 for both pairs, only the AR date differs per milestone.
type SeedDocumentPair = {
  milestoneTitle: string;
  amount: string;
  amountInWords: string;
  documentNumberSuffix: string;
  arDocumentDate: string;
};

const FNB_PAID_MILESTONES: SeedDocumentPair[] = [
  {
    milestoneTitle: "Project Mobilization and Initial Development",
    amount: "20000.00",
    amountInWords: "Twenty Thousand Pesos Only",
    documentNumberSuffix: "001",
    arDocumentDate: "2026-06-26",
  },
  {
    milestoneTitle: "Core Features Completion",
    amount: "15000.00",
    amountInWords: "Fifteen Thousand Pesos Only",
    documentNumberSuffix: "002",
    arDocumentDate: "2026-06-25",
  },
];

async function seedFnbProject() {
  const [superadmin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, SEED_USERS[0].email))
    .limit(1);
  if (!superadmin) {
    throw new Error(`Seed user ${SEED_USERS[0].email} not found — run seedUsers() first.`);
  }
  const createdByUserId = superadmin.id;

  let [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.title, FNB_PROJECT_TITLE))
    .limit(1);

  if (!project) {
    [project] = await db
      .insert(schema.projects)
      .values({
        title: FNB_PROJECT_TITLE,
        createdByUserId,
        // Billing default (phases-plan-revision-1.md Phase 8) — same
        // value every seeded document below used to repeat by hand, now
        // set once on the project so new documents pick it up
        // automatically instead of being retyped. Payment fields
        // (method/account/bank/number) no longer live on the project
        // (docs/phases-plan-revision-2.md Phase 14) — that info comes
        // from the designated payer's user profile instead.
        billedToName: "Liquor Inventory Solution",
        billedToAttention: "Lourd Borromeo",
      })
      .returning();
  }

  const existingMilestones = await db
    .select()
    .from(schema.milestones)
    .where(eq(schema.milestones.projectId, project.id));

  const milestoneByTitle = new Map(existingMilestones.map((m) => [m.title, m]));

  for (const [index, seedMilestone] of FNB_MILESTONES.entries()) {
    const existing = milestoneByTitle.get(seedMilestone.title);
    if (existing) {
      await db
        .update(schema.milestones)
        .set({
          price: seedMilestone.price,
          status: seedMilestone.status,
          // Synced to the seed's own fixed date every run (not "keep
          // whatever's already in the DB") — completedAt has to match
          // the matching AR's arDocumentDate below (a milestone can't
          // be completed after its own AR was issued), and the old
          // `existing.completedAt ?? new Date()` fallback meant a
          // milestone seeded before this fixed date existed would stay
          // stuck on its original seed-time timestamp forever, drifting
          // from the AR date instead of tracking it.
          completedAt:
            seedMilestone.status === "completed" && seedMilestone.completedAt
              ? new Date(`${seedMilestone.completedAt}T00:00:00Z`)
              : null,
          sortOrder: String(index),
          updatedAt: new Date(),
        })
        .where(eq(schema.milestones.id, existing.id));
    } else {
      const [created] = await db
        .insert(schema.milestones)
        .values({
          projectId: project.id,
          title: seedMilestone.title,
          price: seedMilestone.price,
          status: seedMilestone.status,
          completedAt:
            seedMilestone.status === "completed" && seedMilestone.completedAt
              ? new Date(`${seedMilestone.completedAt}T00:00:00Z`)
              : null,
          sortOrder: String(index),
          createdByUserId,
        })
        .returning();
      milestoneByTitle.set(seedMilestone.title, created);
    }
  }

  // Refresh the map with real ids/status/price after the upsert loop
  // above — this (not FNB_MILESTONES/FNB_PAID_MILESTONES's own string
  // literals) is now the single source of truth the document-insert
  // loop below reads from, so a milestone's title/price and the
  // project's billing fields can never drift out of sync with the
  // invoice/AR generated for them.
  const milestonesAfterUpsert = await db
    .select()
    .from(schema.milestones)
    .where(eq(schema.milestones.projectId, project.id));
  const milestoneByTitleAfterUpsert = new Map(milestonesAfterUpsert.map((m) => [m.title, m]));

  const existingDocuments = await db
    .select()
    .from(schema.projectDocuments)
    .where(eq(schema.projectDocuments.projectId, project.id));

  // Remaining Balance is always derived now (lib/documents/balance.ts:
  // sum of all milestone prices minus sum of milestones already "done"),
  // never a hand-typed number — so the seed has to compute it the same
  // way instead of hardcoding a value that can silently go stale (the
  // second seeded AR used to just say "0.00", which only happened to be
  // right for this particular set of milestone prices by coincidence).
  // totalProjectCost is the sum of every *actual* milestone row's price
  // (not FNB_MILESTONES' own copy of those numbers) so it can never
  // disagree with what the milestones section of the app itself would
  // add up to. doneTotal accumulates as each paired AR below is
  // "issued", in the same order FNB_PAID_MILESTONES lists them.
  const totalProjectCost = milestonesAfterUpsert.reduce((sum, m) => sum + Number(m.price), 0);
  let doneTotal = 0;

  for (const pair of FNB_PAID_MILESTONES) {
    // The milestone row itself — not FNB_PAID_MILESTONES' own amount/
    // milestoneTitle copies — is the source of truth for what this
    // document bills. Its title and price are read straight off the row
    // below (milestone.title/milestone.price), same as
    // app/api/projects/[id]/documents/route.ts's real create flow
    // already does for a document made through the app. amount and
    // amountInWords stay on FNB_PAID_MILESTONES only because
    // amountInWords has no DB column to derive from — but amount itself
    // is asserted against milestone.price just below so the two can't
    // silently disagree.
    const milestone = milestoneByTitleAfterUpsert.get(pair.milestoneTitle);
    if (!milestone) continue;

    if (milestone.price !== pair.amount) {
      throw new Error(
        `Seed data out of sync: milestone "${pair.milestoneTitle}" has price ${milestone.price} ` +
          `but its paired document amount is ${pair.amount}. Update FNB_MILESTONES or ` +
          `FNB_PAID_MILESTONES so the two agree before re-running the seed.`,
      );
    }

    const milestoneId = milestone.id;

    const hasInvoice = existingDocuments.some(
      (doc) => doc.milestoneId === milestoneId && doc.type === "invoice",
    );
    const hasAr = existingDocuments.some((doc) => doc.milestoneId === milestoneId && doc.type === "ar");

    if (!hasInvoice) {
      await db.insert(schema.projectDocuments).values({
        projectId: project.id,
        milestoneId,
        type: "invoice",
        title: project.title,
        milestone: milestone.title,
        price: milestone.price,
        documentNumber: `INV-2026-${pair.documentNumberSuffix}`,
        documentDate: "2026-06-25",
        dueDate: "2026-07-09",
        billedToName: project.billedToName,
        billedToAttention: project.billedToAttention,
        amount: milestone.price,
        amountInWords: pair.amountInWords,
        paymentPurpose: milestone.title,
        agreementDate: "2026-06-25",
        totalProjectCost: totalProjectCost.toFixed(2),
        paymentMethod: "InstaPay",
        paymentAccountName: "Rasty Espartero",
        paymentBank: "MariBank",
        paymentAccountNumber: "09171234567",
        issuedBy: "JJ Bassig, Rasty Espartero",
        isPaid: true,
        createdByUserId,
      });
    }

    // doneTotal advances regardless of hasAr below, so a re-run against
    // an already-seeded DB still lands on the correct running balance
    // for whichever pairs do get (re-)inserted this pass.
    doneTotal += Number(milestone.price);
    const remainingBalance = (totalProjectCost - doneTotal).toFixed(2);

    if (!hasAr) {
      await db.insert(schema.projectDocuments).values({
        projectId: project.id,
        milestoneId,
        type: "ar",
        title: project.title,
        milestone: milestone.title,
        price: milestone.price,
        documentNumber: `AR-2026-${pair.documentNumberSuffix}`,
        documentDate: pair.arDocumentDate,
        receivedFromName: project.billedToName,
        receivedFromAttention: project.billedToAttention,
        amount: milestone.price,
        amountInWords: pair.amountInWords,
        paymentPurpose: milestone.title,
        remainingBalance,
        receivedByName: "Espartero, Rasty",
        receivedByTitle: "Project Lead",
        createdByUserId,
      });
    }
  }

  return { projectId: project.id, milestoneCount: FNB_MILESTONES.length };
}

async function main() {
  console.log("Seeding database...");

  const seeded = await seedUsers();
  await seedBudget();
  await seedExpenses();
  await seedAppSettings();
  const fnb = await seedFnbProject();

  console.log("\nSeeded users:");
  for (const user of seeded) {
    console.log(`  ${user.name} (${user.role}) — ${user.email}`);
  }
  console.log(`\nPassword for both accounts: ${SEED_PASSWORD}`);
  console.log(
    `\nSeeded project: ${FNB_PROJECT_TITLE} (${fnb.milestoneCount} milestones, project id ${fnb.projectId})`,
  );
  console.log("\nSeed complete.");

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
