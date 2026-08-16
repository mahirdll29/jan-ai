import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Two small presentational pieces shared by the login and register forms.
//
// Deliberately NOT a single configurable <AuthForm fields={...}> component.
// There are two forms and five fields between them; a config-driven form would
// be more code than the thing it replaces, and every future change would mean
// adding another option to the config rather than editing markup. Each page
// writes its own <form> and uses these for the repetitive parts.

/**
 * A labelled text input.
 *
 * THE LABEL IS A REAL <label>, ALWAYS, and never a placeholder standing in for
 * one. A placeholder vanishes the instant someone types, which strands anyone
 * who looks away mid-form, uses a screen magnifier, or comes back to a
 * half-filled form and can no longer tell which field is which. Placeholder
 * text also renders in a low-contrast grey by default, and screen readers treat
 * it inconsistently.
 *
 * `htmlFor`/`id` is what ties them together — it is also what makes clicking
 * the label focus the input, which is a noticeably larger tap target on a phone.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  ...inputProps
}: {
  id: string;
  label: string;
  /** Field-level validation message, if any. */
  error?: string;
  /** Persistent helper text, e.g. the password rule. */
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>

      <Input
        id={id}
        // aria-invalid tells assistive tech the value was rejected — without it
        // a red border communicates nothing to anyone not looking at it.
        aria-invalid={error ? true : undefined}
        // Points at the hint and/or the error so both are read out as part of
        // the field, rather than being loose text the user has to go find.
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn(error && "border-destructive")}
        {...inputProps}
      />

      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The form-level error, for whatever the server said.
 *
 * `role="alert"` is the important part: it makes this an ARIA live region, so a
 * screen reader announces the text the moment it appears. Without it a
 * submission can fail, the message can render, and a user who cannot see it
 * gets no indication that anything happened at all — the form just seems inert.
 *
 * It renders nothing when there is no error, rather than an empty box, so the
 * layout does not reserve space for a message that usually is not there.
 */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;

  return (
    <div
      role="alert"
      className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-ink"
    >
      {children}
    </div>
  );
}
