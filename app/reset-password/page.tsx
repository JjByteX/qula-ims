"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleCheck, CircleX, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// Client-side mirror of resetPasswordSchema plus a confirm field — kept
// local since "passwords match" is a form-only concern, not something the
// API needs to validate.
const formSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type FormInput = z.infer<typeof formSchema>;

type TokenState = "checking" | "valid" | "invalid";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("checking");
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((body) => setTokenState(body?.valid ? "valid" : "invalid"))
      .catch(() => setTokenState("invalid"));
  }, [token]);

  async function onSubmit(data: FormInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-[400px] rounded-[var(--radius-lg)]">
        <CardHeader className="p-8 pb-0">
          <CardTitle className="text-[var(--text-xl)]">Reset password</CardTitle>
          {tokenState === "valid" && !done && (
            <CardDescription>Choose a new password for your account.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-8">
          {tokenState === "checking" && (
            <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
              Checking your link...
            </p>
          )}

          {tokenState === "invalid" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CircleX className="size-8 text-[var(--destructive)]" aria-hidden="true" />
              <p className="text-[var(--text-base)] text-[var(--foreground)]">
                This reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password">
                <Button variant="outline" className="mt-2">
                  Request a new link
                </Button>
              </Link>
            </div>
          )}

          {tokenState === "valid" && done && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CircleCheck className="size-8 text-[var(--success)]" aria-hidden="true" />
              <p className="text-[var(--text-base)] text-[var(--foreground)]">
                Password updated. Taking you to login...
              </p>
            </div>
          )}

          {tokenState === "valid" && !done && (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    aria-invalid={!!errors.password}
                    {...register("password")}
                  />
                </div>
                {errors.password && (
                  <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    aria-invalid={!!errors.confirmPassword}
                    {...register("confirmPassword")}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
              )}

              <Button type="submit" size="lg" disabled={!isValid || isSubmitting}>
                {isSubmitting ? "Updating password..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
