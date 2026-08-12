// ONE PrismaClient instance for the entire application.
//
// Why a shared instance instead of `new PrismaClient()` in each file:
//
// `new PrismaClient()` is not a cheap object. Creating one opens a CONNECTION
// POOL — by default (CPU cores * 2) + 1 TCP connections held open to Postgres.
// If five different files each created their own client, we would be holding
// five separate pools open. Neon's free tier caps how many concurrent
// connections the database accepts, so we would eventually get
// "too many connections" errors and the app would start failing under load.
//
// How the sharing actually works: Node CACHES modules. The first time any file
// imports this one, the line below runs exactly once and Node stores the result.
// Every later `import { prisma } from "../lib/prisma"` anywhere in the app gets
// that same object back. That is the whole "singleton" — there is no pattern or
// class involved, it is just how the module system behaves.
//
// (Next.js tutorials wrap this in a `globalThis` cache. That exists because
// Next's hot-module-reload re-executes modules inside a still-running process,
// so clients pile up. Our dev server is `tsx watch`, which restarts the whole
// Node process on save — nothing survives to accumulate, so we don't need it.)

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
