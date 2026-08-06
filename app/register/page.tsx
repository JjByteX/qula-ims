"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, User, Mail, Phone, Lock, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      contactNumber: "",
      email: "",
      description: "",
      password: "",
    },
  });

  function onPictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPictureFile(null);
      setPictureError(null);
      return;
    }
    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
      setPictureFile(null);
      setPictureError("Profile picture exceeds the 2MB limit.");
      e.target.value = "";
      return;
    }
    setPictureError(null);
    setPictureFile(file);
  }

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.set(key, value);
      });
      if (pictureFile) formData.set("profilePicture", pictureFile);

      const res = await fetch("/api/auth/register", { method: "POST", body: formData });
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <Card className="w-full max-w-[480px] rounded-[var(--radius-lg)]">
        <CardHeader className="p-8 pb-0">
          <CardTitle className="text-[var(--text-xl)]">Request an account</CardTitle>
          <CardDescription>
            Fill in your details. A superadmin will review and approve your request.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CircleCheck className="size-8 text-[var(--success)]" aria-hidden="true" />
              <p className="text-[var(--text-base)] text-[var(--foreground)]">
                Your request has been submitted.
              </p>
              <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                A superadmin will review it shortly. You&apos;ll be able to log in once approved.
              </p>
              <Link href="/login" className="mt-2">
                <Button variant="outline">Back to login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    aria-invalid={!!errors.firstName}
                    {...register("firstName")}
                  />
                  {errors.firstName && (
                    <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="middleName">Middle name</Label>
                  <Input id="middleName" autoComplete="additional-name" {...register("middleName")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    aria-invalid={!!errors.lastName}
                    {...register("lastName")}
                  />
                  {errors.lastName && (
                    <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input id="suffix" placeholder="Jr., Sr., III" {...register("suffix")} />
                </div>
              </div>

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

              <div className="flex flex-col gap-2">
                <Label htmlFor="contactNumber">Contact number</Label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="contactNumber"
                    type="tel"
                    autoComplete="tel"
                    className="pl-9"
                    {...register("contactNumber")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
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
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  rows={3}
                  className="flex w-full rounded-[var(--radius-sm)] border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[var(--text-base)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--ring)]"
                  {...register("description")}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="profilePicture">Profile picture</Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="profilePicture"
                    className="flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-[var(--text-sm)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <ImagePlus className="size-4" aria-hidden="true" />
                    {pictureFile ? pictureFile.name : "Choose file"}
                  </label>
                  <input
                    id="profilePicture"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onPictureChange}
                  />
                  <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    JPEG, PNG, or WebP. 2MB max.
                  </span>
                </div>
                {pictureError && (
                  <p className="text-[var(--text-sm)] text-[var(--destructive)]">{pictureError}</p>
                )}
              </div>

              {serverError && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
              )}

              <Button type="submit" size="lg" disabled={!isValid || isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit request"}
              </Button>

              <div className="flex items-center justify-center gap-1 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                <User className="size-4" aria-hidden="true" />
                Already have an account?
                <Link href="/login" className="font-semibold text-[var(--foreground)] hover:underline">
                  Log in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
