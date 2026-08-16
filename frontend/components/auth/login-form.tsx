"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ApiError, auth } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";
import { useAuth } from "./auth-provider";
import { FormError, FormField } from "./form-parts";
import { Button } from "@/components/ui/button";

// ---- WHY THIS SUBMITS FROM THE BROWSER, NOT A SERVER ACTION ---------------
//
// This is the one thing about the login flow that has to be right.
//
// The backend answers a successful login with a `Set-Cookie` header. A
// Set-Cookie only becomes a stored cookie in whichever CLIENT made the request.
// If the request came from a Server Action or a route handler, the cookie is
// handed to the Next.js SERVER — the user's browser never sees it, and every
// subsequent request from that browser is unauthenticated.
//
// So the form calls the backend directly with fetch + credentials: "include",
// and the browser receives the cookie from Express first-hand. This behaves
// identically in development and production, which the server-side route
// notably would not.

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<React.ReactNode>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Client-side checks only avoid a pointless round trip. The server runs the
    // same rules and remains the authority — anything here can be bypassed by
    // anyone who wants to, which is exactly why the server never trusts it.
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "Enter your email address";
    if (!password) errors.password = "Enter your password";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    setFormError(null);

    try {
      const { user } = await auth.login({ email: email.trim(), password });

      // login already returned the user, so there is nothing to re-fetch.
      setUser(user);

      // `replace`, not `push`: the back button should return to wherever the
      // user was before the login page, not to the login page itself.
      router.replace(safeNextPath(next));
    } catch (error) {
      if (error instanceof ApiError) {
        // ---- DO NOT "IMPROVE" THE 401 MESSAGE -------------------------
        //
        // The backend returns a byte-identical `401 Invalid credentials` for
        // BOTH "no account with that email" and "wrong password". That is
        // deliberate: distinct messages would turn this form into a user
        // enumeration oracle, letting anyone check whether a given email
        // address has an account here by watching which error comes back.
        //
        // Splitting it into "no such account" / "wrong password" would be
        // friendlier and would undo a security property the backend went out
        // of its way to build. We render exactly what the server said.
        setFormError(error.message);
      } else {
        setFormError("Can't reach the server. Is the backend running?");
      }
    } finally {
      // In `finally` so the button re-enables on both paths. Left out of the
      // error branch alone, a network failure would leave the form disabled
      // forever with no way to retry.
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormError>{formError}</FormError>

      <FormField
        id="email"
        label="Email"
        type="email"
        // Real password-manager support, and on a phone it selects the keyboard
        // with an @ key. Small detail; large difference in how the form feels.
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
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        disabled={pending}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {/* This link measures about 16px tall, under WCAG 2.5.8's 24px minimum —
          and that is CORRECT here, not an oversight. The success criterion
          exempts a target that is "in a sentence or block of text", because
          padding an inline link to 24px makes its hit area overlap the lines
          above and below it, which is worse for everyone.
          The standalone controls in the chrome get the padding instead; see
          components/shell/account-area.tsx. */}
      <p className="text-sm text-ink-muted">
        No account?{" "}
        <Link
          href="/register"
          className="text-signal-ink underline underline-offset-4"
        >
          Register
        </Link>
      </p>
    </form>
  );
}
