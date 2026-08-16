"use client";

import { useRef, useState } from "react";

import {
  MAX_UPLOAD_BYTES,
  cloudinaryThumb,
  isUploadConfigured,
  uploadImage,
} from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// The photo field. Uploads straight to Cloudinary and hands the resulting URL
// back to the form.
//
// ---- THE UPLOAD NEVER TOUCHES OUR BACKEND ---------------------------------
//
// The file goes browser → Cloudinary, and only the returned URL is sent to
// Express. So our server never parses multipart data, never buffers a 5MB photo
// in memory, and never holds a request open for the length of a slow mobile
// upload. `imageUrl` has been a plain optional string since Module 3, so this
// integration required no backend change at all.

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

export function ImageUpload({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = isUploadConfigured();
  const uploading = progress !== null;

  async function handleFile(file: File) {
    setError(null);

    // ---- CLIENT GUARDS, AND WHAT THEY ARE ACTUALLY FOR -------------------
    //
    // These stop honest mistakes early — a wrong file picked, a 12MB photo
    // straight off a phone camera — so the user finds out instantly instead of
    // after a 30-second upload fails.
    //
    // They are NOT security. Anyone can post to the Cloudinary endpoint
    // directly and skip all of this. The real limits are the ones set on the
    // upload preset in the Cloudinary dashboard (allowed formats, max file
    // size, folder), which are enforced server-side by Cloudinary. Same
    // relationship as RequireAuth and the backend's 401.
    if (!file.type.startsWith("image/")) {
      setError("That's not an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`That image is ${mb}MB. The limit is ${MAX_MB}MB.`);
      return;
    }

    setProgress(0);

    try {
      const { secureUrl } = await uploadImage(file, setProgress);
      onChange(secureUrl);
    } catch (err) {
      // ---- A FAILED UPLOAD MUST NOT COST THE USER THEIR TYPING ----------
      //
      // Upload state lives here; the report's fields live in the parent form.
      // So a failure shows a message next to the photo field and nothing else
      // on the form is touched — the description someone spent two minutes
      // writing survives, and they can retry the photo or submit without one.
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProgress(null);
      // Clear the input so picking the SAME file again still fires onChange.
      // A file input does not emit a change event when the value is unchanged,
      // which makes "retry with the same photo" silently do nothing.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!configured) {
    return (
      <div className="space-y-1.5">
        <Label>Photo</Label>
        <p className="text-sm text-ink-muted">
          Image upload isn&apos;t configured, so you can file this report without
          a photo. Everything else works normally.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="report-photo">Photo (optional)</Label>

      {value ? (
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- see lib/cloudinary.ts */}
          <img
            src={cloudinaryThumb(value, 160, 120) ?? value}
            alt="The photo attached to this report"
            width={160}
            height={120}
            className="rounded-sm border border-rule object-cover"
          />
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">Photo attached.</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            id="report-photo"
            type="file"
            // Filters the OS file picker AND makes a phone offer the camera
            // directly, which is the common case for this app.
            accept="image/*"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="block w-full text-sm text-ink-muted file:mr-4 file:rounded-sm file:border file:border-rule file:bg-paper-sunk file:px-3 file:py-1.5 file:text-ink hover:file:bg-signal-wash"
          />
          <p className="text-sm text-ink-muted">
            Up to {MAX_MB}MB. JPG, PNG or WebP.
          </p>
        </>
      )}

      {uploading && (
        // A real percentage, not a spinner — which is the entire reason
        // lib/cloudinary.ts uses XMLHttpRequest instead of fetch. On mobile
        // data a 4MB photo takes long enough that "is this working?" is a
        // genuine question.
        <div className="space-y-1" aria-live="polite">
          <div
            className="h-1 w-full max-w-xs overflow-hidden bg-paper-sunk"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className="h-full bg-signal transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="docket tnum">Uploading… {progress}%</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
