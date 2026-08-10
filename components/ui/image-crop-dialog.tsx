"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared crop UI for the three image fields on the edit-profile form
// (profile picture, payment QR code, payment signature). One dialog
// component covers all three — only the output shape (circle vs
// square) and the output file's name/type differ, both passed in as
// props — rather than three near-identical dialogs.
//
// Crop math: the image is drawn into a fixed-size square viewport
// (VIEWPORT_SIZE) at `scale`, offset by `offset` (in viewport pixels).
// Dragging updates `offset`; the zoom slider updates `scale` around the
// viewport's center so zooming doesn't visually shift the image.
// Saving reads pixels back out of that same viewport with a canvas at
// OUTPUT_SIZE resolution, so what's drawn on screen is exactly what's
// exported — no separate "preview vs. real crop" math to keep in sync.
const VIEWPORT_SIZE = 320;
const OUTPUT_SIZE = 512;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

type Offset = { x: number; y: number };

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  shape,
  fit = "cover",
  onSave,
  onRemove,
  hasExistingImage,
  outputFileName,
  outputMimeType = "image/png",
  onChooseDifferentFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Object URL (or data URL) of the source image being cropped. Only
  // read when the dialog is open — see the reset effect below.
  imageSrc: string | null;
  shape: "circle" | "square";
  // "cover" (default) scales the image's *shorter* side to fill the
  // viewport, same as a typical avatar/QR cropper — the person pans to
  // choose which part gets cropped off. "contain" scales the image's
  // *longer* side to fit inside the viewport instead, so nothing is
  // ever cropped — for a signature (a thin, wide shape) "cover" was
  // zooming in until the height filled the square and cutting off both
  // sides, which is never what you want for a signature: the whole
  // mark has to stay visible.
  fit?: "cover" | "contain";
  // Fires with the cropped result once the person hits Save.
  onSave: (file: File, previewUrl: string) => void;
  // Fires when the person removes the picture instead of cropping one.
  // Undefined hides the Remove action (nothing to remove yet).
  onRemove?: () => void;
  hasExistingImage: boolean;
  outputFileName: string;
  outputMimeType?: string;
  // Opens the file picker for a different source image without
  // closing the dialog — lets a re-crop turn into a full replace.
  onChooseDifferentFile?: () => void;
}) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ pointerX: number; pointerY: number; offset: Offset } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Fresh crop every time a new image is opened, so a previous file's
  // zoom/pan never leaks into the next one.
  useEffect(() => {
    if (open) {
      setScale(MIN_SCALE);
      setOffset({ x: 0, y: 0 });
      setNaturalSize(null);
    }
  }, [open, imageSrc]);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }

  // Base scale at MIN_SCALE ("no zoom"). "cover" (Math.max) picks the
  // *shorter* side to fill the viewport, so the longer side overflows
  // and gets cropped — right for an avatar or QR code, which are
  // roughly square already and are meant to fill the frame. "contain"
  // (Math.min) picks the *longer* side to fit inside the viewport
  // instead, so the shorter side leaves empty space rather than ever
  // cropping — right for a signature, where the whole wide/short mark
  // has to stay visible no matter its aspect ratio.
  function baseScale() {
    if (!naturalSize) return 1;
    return fit === "contain"
      ? Math.min(VIEWPORT_SIZE / naturalSize.w, VIEWPORT_SIZE / naturalSize.h)
      : Math.max(VIEWPORT_SIZE / naturalSize.w, VIEWPORT_SIZE / naturalSize.h);
  }

  function clampOffset(next: Offset, currentScale: number): Offset {
    if (!naturalSize) return next;
    const drawnW = naturalSize.w * baseScale() * currentScale;
    const drawnH = naturalSize.h * baseScale() * currentScale;
    // Image can pan until its edge reaches the viewport edge, no
    // further — keeps the crop area always fully covered by the image.
    const maxX = Math.max(0, (drawnW - VIEWPORT_SIZE) / 2);
    const maxY = Math.max(0, (drawnH - VIEWPORT_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { pointerX: e.clientX, pointerY: e.clientY, offset };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.pointerX;
    const dy = e.clientY - dragStart.current.pointerY;
    setOffset(
      clampOffset(
        { x: dragStart.current.offset.x + dx, y: dragStart.current.offset.y + dy },
        scale,
      ),
    );
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    dragStart.current = null;
  }

  function onScaleChange(next: number) {
    setScale(next);
    // Re-clamp the existing offset against the new scale so zooming out
    // never leaves the image parked outside the viewport.
    setOffset((prev) => clampOffset(prev, next));
  }

  const handleSave = useCallback(async () => {
    if (!naturalSize) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    // Map viewport-space draw position (VIEWPORT_SIZE) to output-space
    // (OUTPUT_SIZE) with a single ratio, so the exported image matches
    // the on-screen crop exactly regardless of the two sizes differing.
    const ratio = OUTPUT_SIZE / VIEWPORT_SIZE;
    const drawnW = naturalSize.w * baseScale() * scale * ratio;
    const drawnH = naturalSize.h * baseScale() * scale * ratio;
    const drawX = OUTPUT_SIZE / 2 - drawnW / 2 + offset.x * ratio;
    const drawY = OUTPUT_SIZE / 2 - drawnH / 2 + offset.y * ratio;

    const img = imgRef.current;
    if (!img) return;
    ctx.drawImage(img, drawX, drawY, drawnW, drawnH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], outputFileName, { type: outputMimeType });
        const previewUrl = URL.createObjectURL(blob);
        onSave(file, previewUrl);
        onOpenChange(false);
      },
      outputMimeType,
      0.92,
    );
  }, [naturalSize, scale, offset, shape, outputFileName, outputMimeType, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] p-6">
        <DialogTitle>Adjust image</DialogTitle>
        <DialogDescription>
          Drag to reposition, then use the slider to zoom in or out.
        </DialogDescription>

        <div className="mt-4 flex flex-col items-center gap-4">
          <div
            className={cn(
              "relative overflow-hidden bg-[var(--muted)] border border-[var(--border)] touch-none select-none",
              shape === "circle" ? "rounded-full" : "rounded-[var(--radius-sm)]",
            )}
            style={{
              width: VIEWPORT_SIZE,
              height: VIEWPORT_SIZE,
              cursor: imageSrc ? (isDragging ? "grabbing" : "grab") : "default",
            }}
            onPointerDown={imageSrc ? onPointerDown : undefined}
            onPointerMove={imageSrc ? onPointerMove : undefined}
            onPointerUp={imageSrc ? onPointerUp : undefined}
            onPointerLeave={(e) => {
              if (isDragging) onPointerUp(e);
            }}
          >
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- drawn
              // to an offscreen canvas at save time, not a next/image case
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                draggable={false}
                onLoad={onImageLoad}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={
                  naturalSize
                    ? {
                        width: naturalSize.w * baseScale() * scale,
                        height: naturalSize.h * baseScale() * scale,
                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                      }
                    : { opacity: 0 }
                }
              />
            ) : (
              <button
                type="button"
                onClick={onChooseDifferentFile}
                className="flex size-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ZoomIn className="size-6" aria-hidden="true" />
                <span className="text-[var(--text-sm)]">Choose an image</span>
              </button>
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomIn className="size-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={scale}
              onChange={(e) => onScaleChange(Number(e.target.value))}
              disabled={!imageSrc}
              aria-label="Zoom"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--muted)] accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>

          {imageSrc && onChooseDifferentFile && (
            <button
              type="button"
              onClick={onChooseDifferentFile}
              className="text-[var(--text-sm)] text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
            >
              Choose a different image
            </button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {onRemove && hasExistingImage ? (
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--destructive)] hover:text-[var(--destructive)]"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove picture
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!imageSrc || !naturalSize}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
