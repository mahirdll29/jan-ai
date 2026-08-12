import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// TELLING TYPESCRIPT ABOUT req.userId
//
// Express's `Request` type has no `userId` property, so `req.userId = ...` would
// be a compile error. The fix is DECLARATION MERGING: TypeScript lets you
// re-open an existing interface and add to it. Everything declared below is
// merged into Express's own Request type across the entire project — which is
// why route files can read `req.userId` without importing anything from here.
//
// `declare global` is needed because this file is a module (it has imports), so
// without it these declarations would be local to this file.
//
// Why optional (`userId?`) rather than required: it genuinely IS absent on any
// request that hasn't passed through this middleware. Declaring it required
// would be a lie that TypeScript would then happily let us act on. The cost is
// that protected handlers need `req.userId!` to assert it's there — a small,
// honest annoyance rather than a hidden falsehood.
//
// The alternative most tutorials use is `(req as any).userId`, which switches
// off type checking at every single use site. This does it once, properly.
// ---------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Read the secret once at startup rather than on every request, and refuse to
// start at all if it's missing — failing loudly at boot beats failing
// mysteriously on the first login.
//
// Every value in process.env is typed `string | undefined`, because TypeScript
// has no idea what's in your .env file. The `?? ""` gives us a plain `string`
// immediately, so nothing further down needs a cast or a null check; the guard
// below then rejects the empty case.
const JWT_SECRET = process.env.JWT_SECRET ?? "";
if (JWT_SECRET === "") {
  throw new Error("JWT_SECRET is missing from .env — cannot verify tokens.");
}

// The gate for protected routes. Used as:
//   router.get("/me", requireAuth, asyncHandler(handler))
// Express runs middleware left to right, so requireAuth either stops the request
// or hands control to the handler with req.userId populated.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // cookie-parser (registered in index.ts) is what turns the raw Cookie header
  // into this object. If cookie-parser were missing or registered too late,
  // req.cookies would be undefined and this line would throw.
  const token = req.cookies.token;

  // No cookie at all — the user never logged in, or already logged out.
  if (!token) {
    // NOTE the `return`. We respond and do NOT call next(), so the route handler
    // never runs. Forgetting the return here is a classic bug: the handler runs
    // anyway and you get "Cannot set headers after they are sent".
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // jwt.verify does two things: recomputes the signature from the header and
    // payload using our secret and checks it matches (proving the token wasn't
    // tampered with), and checks the `exp` claim (proving it hasn't expired).
    // It THROWS on either failure rather than returning null — hence try/catch.
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Hand the identity down to the route handler. This is the whole point of
    // the middleware: handlers never touch cookies or JWTs, they just read
    // req.userId.
    req.userId = payload.userId;

    // No argument = "carry on to the next thing in the chain".
    next();
  } catch {
    // Deliberately one response for every failure — tampered signature, expired
    // token, malformed garbage. The client has no legitimate use for the
    // distinction, and telling an attacker *why* their forged token failed helps
    // them refine it.
    return res.status(401).json({ error: "Not authenticated" });
  }
}
