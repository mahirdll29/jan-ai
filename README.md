# JAN-AI

A civic issue reporting platform. People report things like potholes, garbage dumps, broken streetlights or drainage problems, mark the location, and the report goes into a dashboard where it can be tracked. AI runs on top of each report to pull out a summary, guess the severity and tag it.

Still building this. Backend first, frontend after.

## Why

Most civic complaint systems are either a phone number nobody picks up or a form that goes nowhere. The idea here was to make reporting take about ten seconds, and then actually do something useful with the data instead of letting it sit in a table.

The AI part is deliberately optional. If the AI provider is down, reports still save fine. It only adds severity, a summary and tags after the fact.

## Where it's at

- [x] Database schema and migrations
- [x] Auth — register, login, logout, current user
- [ ] Report CRUD + search/filter
- [ ] AI enhancement pipeline
- [ ] Dashboard stats
- [ ] Frontend

## Stack

```
Frontend
├── Next.js
├── TypeScript
├── Tailwind CSS
└── shadcn/ui

Backend
├── Node.js
├── Express.js
├── REST APIs
├── Prisma
└── PostgreSQL (Neon)

Authentication
├── JWT
├── bcrypt
└── HTTP-only cookies

External Services
├── Cloudinary    → image storage
└── Groq API      → AI enhancement
```

## Data model

Two tables. `User` and `Report`, one-to-many.

The thing I spent the most time on was deciding what's required and what isn't. Anything the citizen fills in (title, description, category, coordinates) is required. Anything the AI generates later (severity, summary, tags) is nullable. That way a report can never fail to save just because the AI call failed.

Category, severity and status are Postgres enums rather than lookup tables. Five fixed categories that only I control, so a join on every read wasn't worth it. Downside is adding a category later needs a migration.

IDs are `cuid()` instead of auto-increment, since report IDs show up in URLs and sequential numbers would let anyone count how many reports exist.

Coordinates are just two floats. PostGIS is the right tool if you need real radius search, but a bounding box filter is fine at this scale and it's one less thing to set up.

## Auth

Pretty standard. Password gets hashed with bcrypt, JWT is signed with a secret from env and set as an httpOnly cookie so JavaScript can't touch it. A `requireAuth` middleware reads the cookie, verifies the token and attaches the user id to the request.

Login returns the same generic "invalid credentials" whether the email doesn't exist or the password is wrong. Different messages would let someone check which emails are registered.

No refresh tokens yet. Also no password reset, no rate limiting, no roles. Left out on purpose for now, not forgotten.

## Running it

You'll need Node and a Postgres database (I used Neon's free tier).

```bash
cd backend
npm install
cp .env.example .env    # fill in your own values
npx prisma migrate dev
npm run dev
```

Server runs on port 5000 by default.

Env vars you need:

```
DATABASE_URL=
JWT_SECRET=
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API

```
GET    /health

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me        (needs auth)
```

Report routes coming next.

## Things I'd change

`onDelete: Cascade` on the user relation is probably wrong here. If someone deletes their account, their reports disappear too, and civic complaints arguably shouldn't vanish because one person left. A soft delete that keeps the report and anonymises the author would be better.

There's also no way to tell "AI hasn't run yet" from "AI ran and failed" right now, since both leave the fields null. An `aiStatus` field would fix that.
