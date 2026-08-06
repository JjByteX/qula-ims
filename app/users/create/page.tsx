import { requireSuperadmin } from "@/lib/auth/session";
import { CreateAccountForm } from "./create-account-form";

// Superadmin-only page (phases-plan 1.6). requireSuperadmin() redirects
// signed-out users to /login and signed-in non-superadmins to /dashboard.
export default async function CreateAccountPage() {
  await requireSuperadmin();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <CreateAccountForm />
    </main>
  );
}
