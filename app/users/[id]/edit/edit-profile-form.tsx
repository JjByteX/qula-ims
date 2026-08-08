"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation/auth";

const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

type Profile = {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  contactNumber: string | null;
  description: string | null;
  profilePictureUrl: string | null;
  paymentQrCodeUrl: string | null;
  paymentMethod: string | null;
  paymentAccountName: string | null;
  paymentBank: string | null;
  paymentAccountNumber: string | null;
  paymentSignatureUrl: string | null;
};

export function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(profile.profilePictureUrl);
  const [pictureError, setPictureError] = useState<string | null>(null);

  // Payment QR code and signature (docs/phases-plan-revision-1.md Phase
  // 12.2) — same pick-file-then-preview pattern as the profile picture
  // just above, just two more image fields.
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(profile.paymentQrCodeUrl);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);

  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    profile.paymentSignatureUrl,
  );
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    mode: "onChange",
    defaultValues: {
      firstName: profile.firstName,
      middleName: profile.middleName ?? "",
      lastName: profile.lastName,
      suffix: profile.suffix ?? "",
      contactNumber: profile.contactNumber ?? "",
      description: profile.description ?? "",
      paymentMethod: profile.paymentMethod ?? "",
      paymentAccountName: profile.paymentAccountName ?? "",
      paymentBank: profile.paymentBank ?? "",
      paymentAccountNumber: profile.paymentAccountNumber ?? "",
    },
  });

  function onPictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
      setPictureError("Profile picture exceeds the 2MB limit.");
      e.target.value = "";
      return;
    }
    setPictureError(null);
    setPictureFile(file);
    setPicturePreview(URL.createObjectURL(file));
  }

  function onQrCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
      setQrCodeError("QR code image exceeds the 2MB limit.");
      e.target.value = "";
      return;
    }
    setQrCodeError(null);
    setQrCodeFile(file);
    setQrCodePreview(URL.createObjectURL(file));
  }

  function onSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
      setSignatureError("Signature image exceeds the 2MB limit.");
      e.target.value = "";
      return;
    }
    setSignatureError(null);
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  }

  async function onSubmit(data: ProfileUpdateInput) {
    setServerError(null);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.set(key, value);
      });
      if (pictureFile) formData.set("profilePicture", pictureFile);
      if (qrCodeFile) formData.set("paymentQrCode", qrCodeFile);
      if (signatureFile) formData.set("paymentSignature", signatureFile);

      const res = await fetch(`/api/users/${profile.id}`, { method: "PATCH", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/users/${profile.id}`);
      router.refresh();
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();

  return (
    <Card className="w-full max-w-[480px] rounded-[var(--radius-lg)]">
      <CardHeader className="p-6 pb-0">
        <CardTitle className="text-[var(--text-xl)]">Edit profile</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={picturePreview ?? undefined} alt="" />
              <AvatarFallback className="text-[var(--text-lg)]">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="profilePicture"
                className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-[var(--text-sm)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                <ImagePlus className="size-4" aria-hidden="true" />
                {pictureFile ? pictureFile.name : "Change picture"}
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
              {pictureError && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">{pictureError}</p>
              )}
            </div>
          </div>

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
            <Label htmlFor="contactNumber">Contact number</Label>
            <Input id="contactNumber" type="tel" autoComplete="tel" {...register("contactNumber")} />
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

          {/* Payment details (docs/phases-plan-revision-1.md Phase 12.2)
              — only meaningful once this user is (or might become) the
              designated payer (Settings' "Who receives payment" card),
              so every field here is optional; leaving it blank is a
              normal, valid state, not an error. */}
          <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-5">
            <span className="text-[var(--text-sm)] font-semibold text-[var(--foreground)]">
              Payment details
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="paymentMethod">Method</Label>
                <Input id="paymentMethod" placeholder="InstaPay" {...register("paymentMethod")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="paymentAccountName">Account name</Label>
                <Input id="paymentAccountName" {...register("paymentAccountName")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="paymentBank">Bank</Label>
                <Input id="paymentBank" {...register("paymentBank")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="paymentAccountNumber">Account number</Label>
                <Input id="paymentAccountNumber" {...register("paymentAccountNumber")} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="paymentQrCode">QR code</Label>
              <div className="flex items-center gap-4">
                {qrCodePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodePreview}
                    alt=""
                    className="size-16 rounded-[var(--radius-sm)] border border-[var(--border)] object-contain"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-[var(--muted-foreground)]">
                    <ImagePlus className="size-5" aria-hidden="true" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="paymentQrCode"
                    className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-[var(--text-sm)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <ImagePlus className="size-4" aria-hidden="true" />
                    {qrCodeFile ? qrCodeFile.name : "Upload QR code"}
                  </label>
                  <input
                    id="paymentQrCode"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onQrCodeChange}
                  />
                  <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    JPEG, PNG, or WebP. 2MB max.
                  </span>
                  {qrCodeError && (
                    <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                      {qrCodeError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="paymentSignature">Signature</Label>
              <div className="flex items-center gap-4">
                {signaturePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signaturePreview}
                    alt=""
                    className="size-16 rounded-[var(--radius-sm)] border border-[var(--border)] object-contain"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-[var(--muted-foreground)]">
                    <ImagePlus className="size-5" aria-hidden="true" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="paymentSignature"
                    className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-[var(--text-sm)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <ImagePlus className="size-4" aria-hidden="true" />
                    {signatureFile ? signatureFile.name : "Upload signature"}
                  </label>
                  <input
                    id="paymentSignature"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onSignatureChange}
                  />
                  <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    JPEG, PNG, or WebP. 2MB max.
                  </span>
                  {signatureError && (
                    <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                      {signatureError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {serverError && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={
                !isValid ||
                isSubmitting ||
                (!isDirty && !pictureFile && !qrCodeFile && !signatureFile)
              }
            >
              <Save className="size-4" aria-hidden="true" />
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
