# LearnHub

Community learning platform with a Discord-style interface: communities share videos and articles, discuss them live by text and voice notes, quiz each other, battle in live quizzes, and study together in rooms with synced video and voice.

```
learnhub/
└── web/    Next.js 16 full-stack app (TypeScript, Tailwind, Drizzle ORM, Better Auth)
```

Runs fully locally, no Docker and no paid services required.

Project intent, plans, architecture, decisions and the release checklist live in [`docs/SDLC.md`](docs/SDLC.md).

## Features

| Area | What it does |
|---|---|
| Communities | Public or private (invite link), owner / moderator / member roles |
| Posts | YouTube videos (embedded), articles (link preview), notes — each post is a "channel" |
| Discussion | Live chat per post (Server-Sent Events), replies, voice notes, delete, report |
| Quizzes | Multiple-choice quizzes with instant feedback, server-side scoring, leaderboard |
| Live battles | Kahoot-style timed quiz battles with speed scoring and a live scoreboard |
| Study rooms | Peer-to-peer voice (WebRTC) + synced YouTube playback + chat |
| Progress | XP (with daily caps), levels, streaks, badges, profiles, community leaderboards |
| Moderation | Report posts/messages/quizzes; moderator review queue |
| Notifications | Live in-app bell for replies, comments on your posts and live battles |
| PWA | Installable ("Add to Home Screen"), light/dark theme follows the device |

## Prerequisites (macOS)

```bash
brew install postgresql@14
nvm install 22            # Node 22 (see .nvmrc)
brew services start postgresql@14
```

One-time database setup:

```bash
createuser learnhub
psql -d postgres -c "ALTER USER learnhub WITH PASSWORD 'learnhub';"
createdb -O learnhub learnhub
```

## Run

```bash
cd web
nvm use
npm install
cp .env.example .env.local   # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

> The microphone (voice notes, study rooms) only works on `localhost` or HTTPS. To test on a phone over your
> Wi-Fi, run `npx next dev --experimental-https` and open the HTTPS address it prints.

## Share for testing (from your own machine)

```bash
brew install cloudflared   # once
cd web
npm run share
```

This builds the app, opens a free Cloudflare quick tunnel, and prints an `https://….trycloudflare.com` link
anyone can open. Logins are configured for that link automatically. The link changes every time you run it,
and the app is only reachable while the command is running and your Mac is awake.

## How it fits together

- **Pages and mutations:** React Server Components + Server Actions (`web/src/server/*-actions.ts`).
  Every exported action checks the session and permissions itself.
- **Realtime:** Postgres `LISTEN/NOTIFY` (`web/src/server/realtime.ts`) fans events out to Server-Sent Events
  streams (`web/src/server/sse.ts`). Works across multiple server instances, no Redis needed.
- **Voice/video in study rooms:** WebRTC mesh between browsers; the server only relays signalling.
  Uses Google's public STUN server. Some strict networks need a TURN relay (not included).
- **Files:** voice notes are stored on local disk (`web/uploads/`, see `web/src/server/storage.ts`).
  Swap that module for S3 / Cloudflare R2 in production.

## Database

- Schema lives in `web/src/db/schema/` (Drizzle).
- After changing the schema: `npm run db:generate` (creates a migration in `web/drizzle/`), then `npm run db:migrate`.
- `npm run db:studio` opens a browser UI to inspect data.

## Auth

Email + password via [Better Auth](https://www.better-auth.com). Sessions are stored in Postgres and sent as an httpOnly cookie.

- Server: `web/src/lib/auth.ts`, API mounted at `/api/auth/*`
- Client: `web/src/lib/auth-client.ts`
- Protected pages check the session on the server (`auth.api.getSession`); `web/src/proxy.ts` only does fast redirects.

## Icons

PWA icons in `web/public/` are generated with `node scripts/generate-icons.mjs` (run from `web/`).
