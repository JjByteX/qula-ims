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
};

export function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(profile.profilePictureUrl);
  const [pictureError, setPictureError] = useState<string | null>(null);

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

  async function onSubmit(data: ProfileUpdateInput) {
    setServerError(null);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.set(key, value);
      });
      if (pictureFile) formData.set("profilePicture", pictureFile);

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
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-[var(--text-xl)]">Edit profile</CardTitle>
      </CardHeader>
      <CardContent className="p-8">
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

          {serverError && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={!isValid || isSubmitting || (!isDirty && !pictureFile)}
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
