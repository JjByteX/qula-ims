"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CroppedImageField } from "@/components/ui/cropped-image-field";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation/auth";

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

// A cropped image field can be in one of three states relative to
// what's saved on the server: untouched (edit === null, preview is
// still the original URL), replaced with a newly cropped file (edit
// holds the File to upload), or removed (edit === "removed", preview
// cleared to null). onSubmit below turns "removed" into an explicit
// removeX flag so the server can tell "no change" apart from "clear
// it" — leaving the field out of the request would only ever mean the
// former.
type ImageEdit = File | "removed" | null;

export function EditProfileForm({
  profile,
  stayOnPage,
  fillHeight,
}: {
  profile: Profile;
  // When true (used from app/settings/page.tsx, where this form now
  // renders inline instead of on its own page — docs/phases-plan-
  // revision-2.md Phase 21), saving shows an inline confirmation and
  // refreshes in place instead of navigating to the profile-view page.
  // Settings has its own Back button at the page level (matching the
  // invoice/AR toolbar's pattern) instead of this form's own Cancel,
  // since there's no longer a separate edit page to cancel out of.
  stayOnPage?: boolean;
  // When true (Settings only), the Card stretches to fill its flex
  // parent's height — same h-full/min-h-0 + internal overflow-y-auto
  // shape as the dashboard's cards (see RecentActivity) — instead of
  // sizing to its own content, so the white card box itself reaches
  // the bottom of the viewport like the dashboard's cards do, rather
  // than leaving empty space below a short form.
  fillHeight?: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Each image field pairs an edit (what to send on submit) with a
  // preview (what's rendered right now) — cropping or removing updates
  // both together so the preview never drifts from what will actually
  // be saved. Picking/cropping/removing all go through
  // components/ui/cropped-image-field.tsx, which is also what renders
  // the click-to-open-crop-modal image itself.
  const [pictureEdit, setPictureEdit] = useState<ImageEdit>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(profile.profilePictureUrl);

  const [qrCodeEdit, setQrCodeEdit] = useState<ImageEdit>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(profile.paymentQrCodeUrl);

  const [signatureEdit, setSignatureEdit] = useState<ImageEdit>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    profile.paymentSignatureUrl,
  );

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

  async function onSubmit(data: ProfileUpdateInput) {
    setServerError(null);
    setSaved(false);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.set(key, value);
      });

      if (pictureEdit instanceof File) formData.set("profilePicture", pictureEdit);
      else if (pictureEdit === "removed") formData.set("removeProfilePicture", "true");

      if (qrCodeEdit instanceof File) formData.set("paymentQrCode", qrCodeEdit);
      else if (qrCodeEdit === "removed") formData.set("removePaymentQrCode", "true");

      if (signatureEdit instanceof File) formData.set("paymentSignature", signatureEdit);
      else if (signatureEdit === "removed") formData.set("removePaymentSignature", "true");

      const res = await fetch(`/api/users/${profile.id}`, { method: "PATCH", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      if (stayOnPage) {
        setSaved(true);
        router.refresh();
        return;
      }
      router.push(`/users/${profile.id}`);
      router.refresh();
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
  const hasImageEdits = pictureEdit !== null || qrCodeEdit !== null || signatureEdit !== null;

  return (
    <Card
      className={
        fillHeight
          ? "flex h-full min-h-0 w-full flex-col rounded-[var(--radius-lg)]"
          : stayOnPage
            ? "w-full rounded-[var(--radius-lg)]"
            : "w-full max-w-[860px] rounded-[var(--radius-lg)]"
      }
    >
      <CardHeader className={fillHeight ? "shrink-0 p-6 pb-0" : "p-6 pb-0"}>
        <CardTitle className="text-[var(--text-xl)]">Edit profile</CardTitle>
      </CardHeader>
      <CardContent
        className={
          fillHeight ? "flex min-h-0 flex-1 flex-col overflow-y-auto p-6" : "p-6"
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-5" noValidate>
          {/* Two columns: profile basics on the left, payment details on
              the right, split by a vertical divider — mirrors how
              Settings already separates "who receives payment" from the
              rest of the page, just within this one form now. Stacks to
              a single column with a horizontal divider below md, since
              there's no room for two columns on narrow screens. */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <div className="flex flex-col gap-5">
              {/* Avatar sits to the left of first name/middle name +
                  last name/suffix, spanning both rows — so it grows
                  taller (size-[168px], matched to those two rows'
                  combined height) instead of sitting above them at the
                  old small size-16. QR code and signature below reuse
                  this same size so all three image squares/circles
                  line up visually. */}
              <div className="flex items-start gap-4">
                {/* Click-to-crop: clicking the avatar opens a modal to
                    reposition/zoom/remove the picture instead of a plain
                    file picker — components/ui/cropped-image-field.tsx —
                    so every stored picture is already framed to a circle
                    before it's ever uploaded. */}
                <CroppedImageField
                  id="profilePicture"
                  label="Profile picture"
                  shape="circle"
                  size={168}
                  preview={picturePreview}
                  fallback={initials}
                  outputFileName="profile-picture.png"
                  onChange={(result) => {
                    if (result) {
                      setPictureEdit(result.file);
                      setPicturePreview(result.previewUrl);
                    } else {
                      setPictureEdit("removed");
                      setPicturePreview(null);
                    }
                  }}
                  className="shrink-0"
                />

                <div className="flex flex-1 flex-col justify-between gap-4">
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
            </div>

            {/* Vertical divider on md+ (centered between the two
                columns), horizontal divider when stacked on narrow
                screens. */}
            <div className="hidden w-px self-stretch bg-[var(--border)] md:block" aria-hidden="true" />
            <div className="h-px w-full bg-[var(--border)] md:hidden" aria-hidden="true" />

            {/* Payment details (docs/phases-plan-revision-1.md Phase 12.2)
                — only meaningful once this user is (or might become) the
                designated payer (Settings' "Who receives payment" card),
                so every field here is optional; leaving it blank is a
                normal, valid state, not an error. */}
            <div className="flex flex-col gap-4">
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

              {/* QR code and signature share a row, each square sized to
                  match the enlarged avatar above (size-[168px]) so all
                  three image inputs line up visually. Same click-to-
                  crop modal as the profile picture above. */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="paymentQrCode">QR code</Label>
                  <CroppedImageField
                    id="paymentQrCode"
                    label="QR code"
                    shape="square"
                    size={168}
                    preview={qrCodePreview}
                    outputFileName="payment-qr-code.png"
                    onChange={(result) => {
                      if (result) {
                        setQrCodeEdit(result.file);
                        setQrCodePreview(result.previewUrl);
                      } else {
                        setQrCodeEdit("removed");
                        setQrCodePreview(null);
                      }
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="paymentSignature">Signature</Label>
                  {/* fit="contain" — a signature is wide and short, so
                      the default "cover" crop was zooming in until the
                      height filled the square frame and cutting off
                      both sides. "contain" fits the signature's longer
                      side (its width) inside the frame instead, so the
                      whole signature always stays visible. */}
                  <CroppedImageField
                    id="paymentSignature"
                    label="Signature"
                    shape="square"
                    fit="contain"
                    size={168}
                    preview={signaturePreview}
                    outputFileName="payment-signature.png"
                    onChange={(result) => {
                      if (result) {
                        setSignatureEdit(result.file);
                        setSignaturePreview(result.previewUrl);
                      } else {
                        setSignatureEdit("removed");
                        setSignaturePreview(null);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {serverError && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
          )}
          {saved && !serverError && !isDirty && !hasImageEdits && (
            <p className="text-[var(--text-sm)] text-[var(--success)]">Profile saved.</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={!isValid || isSubmitting || (!isDirty && !hasImageEdits)}
            >
              <Save className="size-4" aria-hidden="true" />
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
            {!stayOnPage && (
              <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
