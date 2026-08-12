import { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps an async route handler so that a thrown error reaches our error
// middleware instead of crashing the server.
//
// THE PROBLEM THIS SOLVES:
//
// Express 4's router does not `await` your handler. It calls the function and
// moves on. An `async` function always returns a Promise immediately, so if the
// code inside it throws — a database timeout, a bug — the result is a REJECTED
// PROMISE that nobody is watching.
//
// Express never learns an error happened, so it never responds: the client just
// hangs until it times out. Worse, on modern Node an unhandled promise rejection
// terminates the whole process. One bad query takes the entire API down.
//
// THE FIX:
//
// `Promise.resolve(...)` gives us the handler's promise, and `.catch(next)`
// attaches a handler to it. `next` is Express's own function, and calling it
// WITH an argument means "an error happened" — which routes straight to the
// 4-argument errorHandler. So `.catch(next)` is shorthand for
// `.catch((err) => next(err))`.
//
// This is why every route below is written `asyncHandler(async (req, res) => ...)`.
//
// (Worth knowing for interviews: Express 5 does this automatically, and the
// popular `express-async-errors` package patches it into v4. We're on v4 and
// writing it by hand because it's four lines and the mechanism is worth
// understanding.)

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
