"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ApiError, auth } from "@/lib/api";
import { DEFAULT_AFTER_LOGIN } from "@/lib/safe-next";
import { useAuth } from "./auth-provider";
import { FormError, FormField } from "./form-parts";
import { Button } from "@/components/ui/button";

// The same browser-side submission as the login form, and for the same reason:
// register also responds with Set-Cookie, and that cookie has to land in the
// user's browser rather than on the Next server. See login-form.tsx.

/**
 * Mirrors the backend's rule in `src/routes/auth.ts` exactly.
 *
 * Copied rather than shared, because the two live in separate deployables with
 * no common package — and a shared regex would be a build-tooling problem
 * solved for one line. The risk is that they drift, so the source is named here
 * and the server stays authoritative either way.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Also from the backend. Kept as a constant so the hint text cannot disagree with the check. */
const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<React.ReactNode>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = "Enter your name";
    if (!email.trim()) {
      errors.email = "Enter your email address";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = "Please provide a valid email address";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    setFormError(null);

    try {
      const { user } = await auth.register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      // Register signs you in — the backend sets the cookie on 201, so there is
      // no reason to make someone who just proved their email type it again.
      setUser(user);
      router.replace(DEFAULT_AFTER_LOGIN);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The one error worth expanding on, because there is a useful action.
        // Note the backend does NOT hide this: register has to tell you the
        // email is taken, which is why the login form's vagueness is only a
        // partial defence against enumeration — documented honestly in
        // auth-interview-prep.md rather than claimed as airtight.
        setFormError(
          <>
            {error.message}.{" "}
            <Link
              href="/login"
              className="text-signal-ink underline underline-offset-4"
            >
              Sign in instead
            </Link>
            .
          </>
        );
      } else if (error instanceof ApiError) {
        // 400s come back with the server's own specific wording — "Please
        // provide a valid email address", "Password must be at least 8
        // characters". Rendering the server's message means the two can never
        // contradict each other.
        setFormError(error.message);
      } else {
        setFormError("Can't reach the server. Is the backend running?");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormError>{formError}</FormError>

      <FormField
        id="name"
        label="Name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        disabled={pending}
      />

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        disabled={pending}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        // "new-password" rather than "current-password" is what prompts a
        // password manager to OFFER to generate one instead of trying to fill
        // an existing credential.
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        disabled={pending}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-signal-ink underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
