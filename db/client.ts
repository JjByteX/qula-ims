import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

// Reuse the connection across hot reloads in dev so we don't open a new
// pool on every file save.
const globalForDb = globalThis as unknown as {
  queryClient: postgres.Sql | undefined;
};

const queryClient =
  globalForDb.queryClient ?? postgres(process.env.DATABASE_URL, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.queryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
