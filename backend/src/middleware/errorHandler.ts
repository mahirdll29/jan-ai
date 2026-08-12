import { Request, Response, NextFunction } from "express";

// The central error handler. Every error that isn't handled inside a route ends
// up here.
//
// HOW EXPRESS KNOWS THIS IS AN ERROR HANDLER — this is the part worth
// remembering: Express literally counts the function's parameters (`fn.length`)
// when you register it. FOUR parameters means "error handler". THREE means
// "normal middleware".
//
// So the unused `next` parameter below is load-bearing. If you delete it because
// it looks pointless, this silently stops being an error handler, errors stop
// reaching it, and Express falls back to its default HTML error page — which
// leaks a full stack trace to the client.
//
// Unlike normal middleware, this is SKIPPED during the ordinary request flow. It
// only runs when something calls `next(err)`, or when a synchronous handler
// throws. It must be registered LAST in index.ts, because when an error occurs
// Express only searches FORWARD from that point for a 4-argument function.

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Full detail goes to OUR server log, where we can actually debug it.
  console.error(err);

  // The client gets a generic message and nothing else. We deliberately do not
  // send `err.message` or a stack trace: stack traces expose file paths, library
  // versions and sometimes query/table names, all of which help an attacker map
  // the system.
  res.status(500).json({ error: "Something went wrong" });
}
