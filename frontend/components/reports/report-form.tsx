"use client";

import { useState } from "react";

import { FormError, FormField } from "@/components/auth/form-parts";
import { ImageUpload } from "./image-upload";
import { LocationField } from "./location-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

// The report form, shared by create and edit.
//
// Not a clever abstraction: the two pages need the same five fields, so this
// holds the fields and each page supplies its own `onSubmit`. Creating calls
// POST, editing calls PATCH with only what changed. The form does not know or
// care which.

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export type ReportFormValues = {
  title: string;
  description: string;
  category: Category;
  /** Strings while typing; converted to numbers only at submit. */
  latitude: string;
  longitude: string;
  imageUrl: string | null;
};

export type ReportFormSubmit = {
  title: string;
  description: string;
  category: Category;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
};

const EMPTY: ReportFormValues = {
  title: "",
  description: "",
  category: "POTHOLE",
  latitude: "",
  longitude: "",
  imageUrl: null,
};

/**
 * Parses a coordinate the way the backend expects one.
 *
 * The coordinate is held as a STRING while typing, because "23." and "-" are
 * valid intermediate states that are not numbers. Conversion happens once, here,
 * at submit.
 *
 * `Number("")` is 0 — not NaN — so the empty check has to come first. Without
 * it, leaving latitude blank would silently file the report at the equator.
 */
function parseCoordinate(raw: string, limit: number): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < -limit || parsed > limit) return null;

  return parsed;
}

export function ReportForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ReportFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: ReportFormSubmit) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<ReportFormValues>({ ...EMPTY, ...initial });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ReportFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Mirrors the backend's rules so an obvious mistake does not cost a round
    // trip. The server revalidates all of it and stays the authority.
    const errors: typeof fieldErrors = {};
    if (!values.title.trim()) errors.title = "Give the report a title";
    if (!values.description.trim()) errors.description = "Describe the issue";

    const latitude = parseCoordinate(values.latitude, 90);
    const longitude = parseCoordinate(values.longitude, 180);
    if (latitude === null) errors.latitude = "Enter a latitude between -90 and 90";
    if (longitude === null) errors.longitude = "Enter a longitude between -180 and 180";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    setFormError(null);

    try {
      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        // REAL JSON NUMBERS. The backend rejects strings outright rather than
        // coercing them, precisely because Number("abc") is NaN and NaN would
        // otherwise land in a Float column unnoticed.
        latitude: latitude as number,
        longitude: longitude as number,
        imageUrl: values.imageUrl,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
      setPending(false);
    }
    // No setPending(false) on success: the page navigates away, and re-enabling
    // the button first would let an impatient second click fire a duplicate.
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-7">
      <FormError>{formError}</FormError>

      <FormField
        id="title"
        label="Title"
        placeholder="Blocked storm drain on Ring Road"
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        error={fieldErrors.title}
        disabled={pending}
      />

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          rows={5}
          placeholder="What is wrong, how long it has been like this, and anything that makes it urgent."
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={fieldErrors.description ? "description-error" : undefined}
          // Styled to match the shadcn Input rather than importing a Textarea
          // primitive for one use.
          className={cn(
            "w-full rounded-md border bg-transparent px-3 py-2 text-base outline-none",
            fieldErrors.description ? "border-destructive" : "border-input"
          )}
        />
        {fieldErrors.description && (
          <p id="description-error" className="text-sm text-destructive">
            {fieldErrors.description}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="docket mb-2">Category</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => {
            const active = values.category === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => set("category", category)}
                // A radio group in behaviour, so aria-pressed communicates
                // which one is chosen. Without it a screen reader reads five
                // identical buttons with no indication of the current value.
                aria-pressed={active}
                disabled={pending}
                className={cn(
                  "docket rounded-full border px-3 py-1.5 transition-colors",
                  active
                    ? "border-signal bg-signal-wash text-signal-ink"
                    : "border-rule text-ink-muted hover:border-ink-muted hover:text-ink"
                )}
              >
                {CATEGORY_LABEL[category]}
              </button>
            );
          })}
        </div>
        {/* Worth saying out loud: this is the one field the AI never touches. */}
        <p className="text-sm text-ink-muted">
          You choose this. The AI assessment never changes it.
        </p>
      </fieldset>

      <LocationField
        latitude={values.latitude}
        longitude={values.longitude}
        onChange={({ latitude, longitude }) =>
          setValues((prev) => ({ ...prev, latitude, longitude }))
        }
        errors={{ latitude: fieldErrors.latitude, longitude: fieldErrors.longitude }}
        disabled={pending}
      />

      <ImageUpload
        value={values.imageUrl}
        onChange={(url) => set("imageUrl", url)}
        disabled={pending}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
