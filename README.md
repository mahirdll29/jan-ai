# JAN-AI

> **v1 is live → [jan-ai-v1.vercel.app](https://jan-ai-v1.vercel.app)**
>
> This is just the first version — many more features are coming. See the [roadmap](#roadmap) below.

A civic issue reporting platform. People report things like potholes, garbage dumps, broken streetlights or drainage problems, mark the location, and the report goes into a dashboard where it can be tracked. AI runs on top of each report to pull out a summary, guess the severity and tag it.

Built backend first, then the frontend on top of it. Both are deployed and running.

## Why

Most civic complaint systems are either a phone number nobody picks up or a form that goes nowhere. The idea here was to make reporting take about ten seconds, and then actually do something useful with the data instead of letting it sit in a table.

The AI part is deliberately optional. If the AI provider is down, reports still save fine. It only adds severity, a summary and tags after the fact.

## Where it's at

- [x] Database schema and migrations
- [x] Auth — register, login, logout, current user
- [x] Report CRUD + search/filter
- [x] AI enhancement pipeline
- [x] Dashboard stats
- [x] Frontend — auth, reports, image upload, map, dashboard
- [x] Landing page, error pages and polish
- [x] Deploy (frontend on Vercel, backend on Render)

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

Map
├── Leaflet
└── OpenStreetMap tiles

External Services
├── Cloudinary    → image storage
└── Groq API      → AI enhancement
```

Went with Leaflet instead of Mapbox for the map. Mapbox needs an account and a token in every
environment; Leaflet with OSM tiles needs neither, and for a read-only map showing pins that's
the whole difference.

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

Then the frontend, in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Runs on port 3000.

Backend env vars:

```
DATABASE_URL=
JWT_SECRET=
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

Frontend env vars:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

The Cloudinary preset has to be an **unsigned** one. Unsigned uploads only need the cloud name and
the preset name, both of which end up in the client bundle anyway — no API key or secret goes near
the frontend. The map needs no key at all.

Everything still works without the Cloudinary vars, you just don't get photo upload. Same with the
Groq key on the backend — reports save fine, they just don't get a summary.

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
GET    /api/auth/me                  (auth)

POST   /api/reports                  (auth)
GET    /api/reports                  public — category, status, search,
                                     bounding box, page, limit
GET    /api/reports/mine             (auth) — page and limit only
GET    /api/reports/:id              public
PATCH  /api/reports/:id              (auth + owner)
DELETE /api/reports/:id              (auth + owner) — 204, no body
POST   /api/reports/:id/enhance      (auth + owner) — re-run the AI

GET    /api/stats                    public — the dashboard, one request
```

Reads are public, writes need the cookie and you can only change your own reports. Civic issues
are public information, so there's no reason to hide the list behind a login.

One thing worth flagging about `/enhance`: it returns 200 even when the AI call failed. A failed
enhancement is a normal state of a report, not an error in the API, so the outcome is in
`aiStatus` in the body rather than the status code.

## Things I'd change

`onDelete: Cascade` on the user relation is probably wrong here. If someone deletes their account, their reports disappear too, and civic complaints arguably shouldn't vanish because one person left. A soft delete that keeps the report and anonymises the author would be better.

No job queue behind the AI. The enhancement is fired without awaiting it, so it lives as an
in-memory promise — restart the server mid-call and that one enrichment is gone for good, with
nothing recording that work was owed. The `/enhance` endpoint is the manual fix. A real answer is
BullMQ or pg-boss, which also gets you retries and backoff.

No rate limiting. `GET /api/reports` and `GET /api/stats` are both unauthenticated database
queries anyone can call in a loop.

The Cloudinary upload preset is unsigned, which means it's readable in the client bundle and
anyone could upload to my account. The preset's own settings (folder, allowed formats, max size)
are what actually bound it. Signed uploads would need a backend endpoint handing out signatures.

Deleting a report doesn't delete its image from Cloudinary, so those accumulate.

Map pins at the same coordinates sit exactly on top of each other. Clustering is the fix, but at
this data volume it'd be solving a problem I don't have yet.

## Roadmap

v1 is shipped. Here's what's coming next:

- [ ] Admin role and moderation dashboard
- [ ] Email notifications on status changes
- [ ] Upvoting / priority from community engagement
- [ ] Rate limiting and abuse prevention
- [ ] Password reset flow
- [ ] Map pin clustering
- [ ] Job queue for AI enhancement (BullMQ / pg-boss)
- [ ] Image cleanup on report deletion
- [ ] Mobile-responsive improvements
- [ ] PWA support
