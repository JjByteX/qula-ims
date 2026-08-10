"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { cn } from "@/lib/utils";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

// One clickable image field that opens the crop dialog directly, used
// for all three image inputs on the edit-profile form (profile
// picture, payment QR code, payment signature). Clicking the image
// itself — not a separate "choose file" step — opens ImageCropDialog
// loaded with whatever's currently showing, so re-cropping an existing
// picture (or removing it) doesn't require picking a new file first.
// Picking a different file from inside the dialog swaps the source
// image without closing the dialog. Only the cropped output (or a
// removal) ever reaches the caller's onChange, so every stored image
// is already cropped to shape.
export function CroppedImageField({
  id,
  label,
  shape,
  fit = "cover",
  size,
  preview,
  fallback,
  outputFileName,
  onChange,
  className,
}: {
  id: string;
  label: string;
  shape: "circle" | "square";
  // "cover" (default, avatar/QR code): the crop dialog zooms so the
  // image's shorter side fills the frame, cropping the rest. "contain"
  // (signature): the crop dialog fits the image's longer side inside
  // the frame instead, so a wide/short signature is never cropped —
  // see components/ui/image-crop-dialog.tsx's baseScale() for the
  // actual math. Only affects the dialog; this field's own small
  // preview button already uses object-contain for any non-avatar
  // image regardless of this prop.
  fit?: "cover" | "contain";
  size: number;
  preview: string | null;
  // Rendered inside the circle when there's no image yet — initials
  // for the profile picture, nothing (falls back to the upload icon)
  // for QR code/signature.
  fallback?: React.ReactNode;
  outputFileName: string;
  onChange: (result: { file: File; previewUrl: string } | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The image currently loaded in the dialog — starts as the existing
  // preview when opened by clicking the avatar/square, and is swapped
  // out if the person picks a different file from inside the dialog.
  const [dialogSrc, setDialogSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setError(null);
    setDialogSrc(preview);
    setDialogOpen(true);
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // always re-fire onChange for the same file picked twice in a row
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setError(`${label} exceeds the 2MB limit.`);
      return;
    }
    setError(null);
    setDialogSrc(URL.createObjectURL(file));
    setDialogOpen(true);
  }

  function handleSave(file: File, previewUrl: string) {
    onChange({ file, previewUrl });
  }

  function handleRemove() {
    onChange(null);
  }

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-[var(--radius-sm)]";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`Change ${label.toLowerCase()}`}
        className={cn("group relative block cursor-pointer overflow-hidden outline-none", shapeClass)}
        style={{ width: size, height: size }}
      >
        {shape === "circle" ? (
          <Avatar style={{ width: size, height: size }} className="border border-[var(--border)]">
            {preview && <AvatarImage src={preview} alt="" />}
            <AvatarFallback style={{ fontSize: size * 0.28 }}>{fallback}</AvatarFallback>
          </Avatar>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            style={{ width: size, height: size }}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] object-contain"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-[var(--muted-foreground)]"
          >
            <ImagePlus className="size-6" aria-hidden="true" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <ImagePlus className="size-6 text-white" aria-hidden="true" />
        </span>
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFilePicked}
      />
      {error && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{error}</p>}

      <ImageCropDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        imageSrc={dialogSrc}
        shape={shape}
        fit={fit}
        onSave={handleSave}
        onRemove={handleRemove}
        hasExistingImage={Boolean(preview)}
        outputFileName={outputFileName}
        onChooseDifferentFile={() => inputRef.current?.click()}
      />
    </div>
  );
}

