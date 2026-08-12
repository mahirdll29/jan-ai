// This MUST be the first import in the file.
//
// Node does not read .env on its own — dotenv copies those values into
// process.env. It has to happen before any other module reads process.env.
//
// Why an `import` and not a `dotenv.config()` call a few lines down: import
// statements are HOISTED. Every imported module is fully executed before the
// first ordinary statement in this file runs. So a `dotenv.config()` written
// below the imports would run too late — any module that read process.env while
// it was being imported would have seen undefined. Imports execute in source
// order, so putting this one first loads .env before anything else runs.
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// ---------------------------------------------------------------------------
// MIDDLEWARE
//
// Express keeps these in an ordered list, and every incoming request walks that
// list from top to bottom. The order below is execution sequence, not style —
// getting it wrong produces real bugs, noted on each one.
// ---------------------------------------------------------------------------

// 1. CORS — first.
//
// By default a browser will not let JavaScript running on http://localhost:3000
// READ a response from http://localhost:5000. Different port means different
// origin, and the browser's same-origin policy blocks it. This is a browser rule
// for the browser's protection — curl and Postman ignore CORS entirely, so this
// is not a defence for our server.
//
// The `cors` package doesn't block anything; it just sets the response headers
// that tell the browser "this origin is allowed".
//
// `credentials: true` sends `Access-Control-Allow-Credentials: true`, which is
// what permits our auth cookie to be sent and stored cross-origin. The frontend
// must ALSO opt in, with `fetch(url, { credentials: "include" })`. Both sides
// are required — if either is missing, login appears to succeed but every later
// request arrives with no cookie and comes back 401.
//
// Note we name an exact origin from .env rather than "*". A wildcard is illegal
// once credentials are enabled; browsers reject that combination outright.
//
// Registered first so the browser's preflight OPTIONS request is answered
// immediately, instead of being dragged through body and cookie parsing.
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// 2. JSON body parsing.
//
// This is the middleware that CREATES req.body — it reads the raw request stream
// and JSON.parse()s it.
//
// If you register it AFTER your routes, req.body is undefined inside every
// handler and you get "Cannot read properties of undefined (reading 'email')".
// That is the single most common Express beginner bug.
app.use(express.json());

// 3. Cookie parsing.
//
// Turns the raw `Cookie: token=eyJhbGciOi...` header string into
// req.cookies.token.
//
// Must come before any route that reads a cookie. Registered after the routes,
// the requireAuth middleware (Part B) would see undefined every time and reject
// perfectly valid logins.
app.use(cookieParser());

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

// No database, no auth — purely to prove the server is running and reachable.
// Hosting platforms use endpoints like this as a health check to decide whether
// an instance is alive.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Mounting the auth router under a prefix. Every route defined in routes/auth.ts
// is served beneath "/api/auth" — so "/login" there becomes "/api/auth/login"
// here. The prefix lives in this one line, not scattered through the route file.
app.use("/api/auth", authRoutes);

// Any request reaching this point matched none of the routes above.
//
// Without this, Express falls back to its built-in HTML 404 page — which is
// jarring for a JSON API, because a frontend calling `await res.json()` would
// blow up trying to parse HTML instead of getting a readable error.
//
// Note this is NOT the error handler: it takes the normal 3 arguments and runs
// in the ordinary request flow. It just has to sit after every route (so it only
// catches genuine misses) and before the error handler (which must stay last).
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// ERROR HANDLING — always registered LAST.
//
// Express searches forward from where an error occurs to find a 4-argument
// function. Anything registered after this point could never be reached by an
// error, so this goes at the very bottom.
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// START THE SERVER
// ---------------------------------------------------------------------------

// Everything in process.env is a STRING, so the port has to be converted to a
// number. If PORT is missing from .env, Number(undefined) is NaN, which is
// falsy, so the `|| 5000` fallback takes over.
const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
