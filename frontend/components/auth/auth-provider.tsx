"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, auth } from "@/lib/api";
import type { User } from "@/lib/types";

// ===========================================================================
// WHO IS SIGNED IN — the single source of truth for the whole app.
//
// ---- WHY THE SESSION IS READ IN THE BROWSER AND NOT ON THE SERVER ---------
//
// The obvious App Router answer is to read the session in a server component
// and pass it down. That does not work for this project, and the reason is
// worth understanding because it is not obvious:
//
// A COOKIE'S SCOPE IS THE HOST THAT SET IT.
//
//   In development the backend is localhost:5000 and it sets a host-only cookie
//   for the host "localhost". Cookies ignore PORTS, so the browser also sends
//   that cookie to localhost:3000 — Next's server can read it, and server-side
//   session reading appears to work perfectly.
//
//   In production the frontend is on *.vercel.app and the backend on
//   *.railway.app. Those are unrelated hosts, so the browser sends the cookie
//   ONLY to Railway. Next's server never receives it and has nothing to
//   forward. Server-side session reading silently returns "signed out" for
//   everybody, and a cookie-presence check in proxy.ts would bounce every
//   logged-in user to /login.
//
// Because it works in dev and fails only once deployed, that is the worst kind
// of bug. Reading the session in the browser behaves identically in both
// environments, so there is nothing to discover at deploy time.
//
// (Three separate rules get confused here and are worth keeping straight:
// COOKIE SCOPE is host-based and ignores port. SAME-SITE compares registrable
// domain and also ignores port — so localhost:3000 and localhost:5000 are
// same-site. CORS ORIGIN includes the port, so they are different origins.)
//
// The upgrade path, if server-side session reading is ever wanted: put both
// services under one parent domain (jan-ai.com and api.jan-ai.com) and set the
// cookie's Domain to .jan-ai.com. Recorded in architecture.md.
// ===========================================================================

/**
 * Three states, not a nullable user.
 *
 * `loading` has to be distinguishable from `anonymous`, because they call for
 * opposite UI: a skeleton versus a "Sign in" link. Collapsing them into
 * `user: User | null` means every consumer renders the signed-out state for a
 * moment on every page load and then flips — a flicker on the most visible
 * element on the page.
 *
 * This is the same lesson as `aiStatus` on the backend: the absence of data is
 * not a status. If a thing can be in more than one state, name the states.
 */
export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "anonymous" };

type AuthContextValue = {
  state: AuthState;

  /**
   * Record a user we already have — called after login and register.
   *
   * Both of those endpoints return the user in their response, so calling
   * /api/auth/me again afterwards would be a second round trip for information
   * already in hand.
   */
  setUser: (user: User) => void;

  /** POST /api/auth/logout, then drop the local state. Navigation is the caller's job. */
  signOut: () => Promise<void>;

  /**
   * Drop the local state WITHOUT calling the server.
   *
   * For when the server has already told us the session is gone — a 401 from
   * any endpoint mid-session, which is what a 7-day token expiring in an open
   * tab looks like. Calling logout there would be pointless: the cookie is
   * already invalid.
   *
   * Phase 4's data pages call this from their catch blocks.
   */
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // `ignore` guards against a state update after unmount, and against the
    // double-invocation React runs deliberately in development StrictMode. The
    // request itself is a harmless idempotent GET either way.
    let ignore = false;

    auth
      .me()
      .then(({ user }) => {
        if (!ignore) setState({ status: "authenticated", user });
      })
      .catch((error) => {
        if (ignore) return;

        // A 401 here is the NORMAL, EXPECTED result for a signed-out visitor —
        // it is an answer, not a failure. Treating it as an error would mean
        // every first-time visitor triggers an error path.
        //
        // Anything else (backend down, DNS, CORS misconfigured) also resolves
        // to anonymous, because from the UI's point of view the outcome is the
        // same: we cannot prove anyone is signed in, so show the signed-out
        // chrome. The distinction is logged, not rendered.
        if (!(error instanceof ApiError)) {
          console.error("[auth] could not reach the backend", error);
        }
        setState({ status: "anonymous" });
      });

    return () => {
      ignore = true;
    };
  }, []);

  const setUser = useCallback((user: User) => {
    setState({ status: "authenticated", user });
  }, []);

  const clearSession = useCallback(() => {
    setState({ status: "anonymous" });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } catch (error) {
      // Deliberately swallowed. If the request failed, the user still asked to
      // sign out, and the local state must reflect that — leaving them looking
      // signed in after they clicked "Sign out" is worse than a lost request.
      console.error("[auth] logout request failed", error);
    }
    setState({ status: "anonymous" });
  }, []);

  return (
    <AuthContext.Provider value={{ state, setUser, signOut, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Read the session. Throws if used outside the provider — a loud failure at the
 * first render beats a silent `undefined` that only breaks once someone signs
 * in.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return value;
}
