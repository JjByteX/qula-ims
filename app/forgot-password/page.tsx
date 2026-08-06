"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-[400px] rounded-[var(--radius-lg)]">
        <CardHeader className="p-8 pb-0">
          <CardTitle className="text-[var(--text-xl)]">Forgot password</CardTitle>
          <CardDescription>
            Enter the email on your account and we&apos;ll send a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CircleCheck className="size-8 text-[var(--success)]" aria-hidden="true" />
              <p className="text-[var(--text-base)] text-[var(--foreground)]">
                If that email is registered, a reset link is on its way.
              </p>
              <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                Check your inbox. The link expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
              )}

              <Button type="submit" size="lg" disabled={!isValid || isSubmitting}>
                {isSubmitting ? "Sending link..." : "Send reset link"}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-[var(--text-sm)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
