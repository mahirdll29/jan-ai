import express, { Response, CookieOptions } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";

// A Router is a mini Express app you attach routes to. index.ts mounts the whole
// thing with `app.use("/api/auth", authRoutes)`, so "/login" below is served at
// "/api/auth/login". Keeping the prefix in exactly one place means changing it
// later is a one-line edit.
const router = express.Router();

// Same startup check as requireAuth: fail loudly at boot, not on first login.
// `?? ""` turns `string | undefined` into a plain `string` so nothing below
// needs a cast; the guard then rejects the empty case.
const JWT_SECRET = process.env.JWT_SECRET ?? "";
if (JWT_SECRET === "") {
  throw new Error("JWT_SECRET is missing from .env — cannot sign tokens.");
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// bcrypt's COST FACTOR. It is exponential: 10 means 2^10 = 1024 rounds of key
// setup, roughly 60-100ms per hash on a normal machine.
//
// Slowness is the entire point. A fast hash like SHA-256 lets an attacker with a
// stolen database try billions of guesses per second on a GPU. bcrypt drags that
// down to thousands. 10 is the ecosystem default: slow enough to be a real
// obstacle, fast enough that login doesn't feel laggy. 12 (~4x slower) is a
// reasonable production choice — the number is meant to be raised as hardware
// gets faster, which is why it's stored inside every hash.
const SALT_ROUNDS = 10;

// Kept as one named constant so the cookie and the token can never drift apart.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

// Everything about the cookie EXCEPT its lifetime.
//
// It's split this way because logout has to clear the cookie using the same
// httpOnly/secure/sameSite/path values it was set with — a browser treats a
// cookie with different attributes as a *different* cookie and leaves the
// original in place. But `clearCookie` must NOT receive maxAge: Express turns
// maxAge into a future expiry date, which would override the "expire
// immediately" instruction that clearing depends on.
const BASE_COOKIE_OPTIONS: CookieOptions = {
  // Invisible to JavaScript. document.cookie cannot see it, so an XSS payload
  // cannot read the token and send it to an attacker's server. This is the whole
  // reason we don't use localStorage, which is just a JS API and trivially
  // readable by any injected script.
  httpOnly: true,

  // Only send over HTTPS. This CANNOT be true in local development: on
  // http://localhost the browser would simply refuse to send the cookie, so
  // login would appear to succeed while /me returned 401 forever.
  secure: isProduction,

  // Controls whether the cookie rides along on cross-site requests.
  // - Dev: localhost:3000 -> localhost:5000 is the SAME site (port doesn't
  //   count), so "lax" works and is the safer default.
  // - Prod: Vercel -> Railway are genuinely different sites, so the cookie would
  //   be dropped under "lax". "none" is required, and browsers reject "none"
  //   unless secure is also true — which is why these two flip together.
  //
  // Tradeoff we are accepting: "none" means the cookie is attached to requests
  // originating from other sites, which is the precondition for CSRF. Documented
  // in docs/auth-interview-prep.md rather than silently ignored.
  sameSite: isProduction ? "none" : "lax",
};

// The exact fields we are willing to send to a client. Prisma's `select` is an
// allowlist: anything not named here is never even fetched from the database.
// That is deliberate — it makes leaking the password hash impossible by
// accident, rather than relying on us remembering to delete it every time.
const SAFE_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
};

// Good enough to catch typos like "mahir@" or "not-an-email". Deliberately not
// trying to be RFC-complete — full email validation by regex is famously a bad
// idea, and the only real proof an address works is sending mail to it.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// HELPER — used by both register and login
// ---------------------------------------------------------------------------

function sendAuthCookie(res: Response, userId: string) {
  // The PAYLOAD IS userId AND NOTHING ELSE. Two reasons:
  //
  // 1. A JWT is base64-encoded, not encrypted. Anyone holding it can read the
  //    payload — paste one into jwt.io and see. The signature only proves it
  //    hasn't been TAMPERED with; it does not hide anything. So no secrets go in.
  // 2. A token is a snapshot frozen for 7 days. Anything embedded here (a name,
  //    a role) goes stale the moment the database changes. Storing only the id
  //    means we always look the user up fresh.
  //
  // jwt.sign adds `iat` (issued at) and, because of expiresIn, `exp` for us.
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });

  // maxAge is MILLISECONDS in Express and must agree with the token's 7d expiry.
  // If the cookie outlived the token the user would look logged in while every
  // request 401'd; if it were shorter they'd be logged out early for no reason.
  res.cookie("token", token, { ...BASE_COOKIE_OPTIONS, maxAge: SEVEN_DAYS_MS });
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    // Hand-written validation. A library like Zod would be less repetitive and
    // would give us types for free, but three checks do not justify a dependency
    // yet — noted as a deliberate scope decision.
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "email, password and name are all required" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    // bcrypt generates a fresh random 16-byte SALT for this user and stores it
    // INSIDE the resulting string: $2b$10$<22-char salt><31-char hash>.
    //
    // The salt is why two users with the same password get completely different
    // hashes, and why a precomputed rainbow table is useless — it would have to
    // be rebuilt per salt. The salt isn't secret, it only needs to be unique.
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name },
        select: SAFE_USER_FIELDS,
      });

      sendAuthCookie(res, user.id);

      // 201 Created, not 200 — a new resource now exists.
      return res.status(201).json({ user });
    } catch (err) {
      // We do NOT check "does this email exist?" before inserting. That check has
      // a race condition: two registrations arriving at the same moment would
      // both find nothing and both insert. Only the database's @unique constraint
      // can actually prevent it, so we let the insert fail and handle it here.
      //
      // P2002 is Prisma's code for "unique constraint violated".
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return res.status(409).json({ error: "That email is already registered" });
      }
      // Anything else isn't ours to handle — rethrow so asyncHandler forwards it
      // to the central error middleware, which logs it and returns a generic 500.
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    // Note: no `select` here, because we need the password hash to compare
    // against. This is the one place the hash is legitimately read — and it never
    // leaves this function, because the response below is built field by field.
    const user = await prisma.user.findUnique({ where: { email } });

    // ---- THE IMPORTANT BIT -------------------------------------------------
    // Both failure branches below return the SAME status and the SAME message.
    //
    // If "no such user" and "wrong password" gave different responses, the login
    // form becomes a USER ENUMERATION oracle: an attacker feeds in a list of
    // email addresses and learns exactly which ones have accounts here, then
    // targets those with credential stuffing or phishing. Being vague costs a
    // little UX clarity and removes that entire capability.
    // ------------------------------------------------------------------------
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // bcrypt.compare reads the cost factor and salt back out of the stored hash,
    // re-hashes the submitted password with them, and compares the results. That
    // is why it needs no salt argument, and why we never "decrypt" anything —
    // hashing is one-way and there is no un-hash function.
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    sendAuthCookie(res, user.id);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
//
// Not async — nothing is awaited, so it needs no asyncHandler.
//
// HONEST LIMITATION: this only deletes the browser's copy of the cookie. The JWT
// itself stays cryptographically valid until its 7-day expiry. If someone had
// already copied the token, logging out does not stop them. That is the core
// tradeoff of stateless JWTs versus server-side sessions (where logout deletes
// the session row and the credential is instantly dead). Fixing it properly
// means a token blocklist or short-lived access tokens plus refresh tokens —
// both deliberately out of scope for v1.
router.post("/logout", (req, res) => {
  // Same options the cookie was set with, minus maxAge — see the comment on
  // BASE_COOKIE_OPTIONS for why both halves of that matter.
  res.clearCookie("token", BASE_COOKIE_OPTIONS);
  res.status(200).json({ message: "Logged out" });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me   (protected)
// ---------------------------------------------------------------------------
//
// The middleware chain runs left to right: requireAuth either responds 401 and
// stops, or sets req.userId and calls next(), at which point the handler runs.
// The handler itself contains no auth logic at all — that separation is exactly
// what makes requireAuth reusable for every Report route in Module 3.
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    // We look the user up fresh rather than trusting the token's contents,
    // so a renamed or deleted account is reflected immediately instead of
    // 7 days from now.
    const user = await prisma.user.findUnique({
      // `!` is safe here specifically because requireAuth guarantees userId is
      // set — the route cannot be reached otherwise.
      where: { id: req.userId! },
      select: SAFE_USER_FIELDS,
    });

    // A valid, unexpired token for an account that no longer exists (deleted
    // since the token was issued). Treated as not authenticated.
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    return res.status(200).json({ user });
  })
);

export default router;
