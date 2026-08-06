import { redirect } from "next/navigation";

// No standalone content lives at "/" — it's just an entry point. Signed-in
// users land on the dashboard; signed-out users get bounced to /login by
// middleware.ts, which already protects everything under /dashboard.
export default function RootPage() {
  redirect("/dashboard");
}
