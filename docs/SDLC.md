# LearnHub — Software Development Life Cycle (SDLC)

A living document. It records **why** LearnHub exists, **what** we planned, **how** it is built, tested and
released, and the decisions behind it. Update it whenever a feature ships or a decision changes. Use the
[feature template](#10-feature-template) at the end to plan anything new.

| | |
|---|---|
| Status | Phase 1 and Phase 2 complete. **Internal testing only** (not open to the public). |
| Code | `learnhub/web` — one Next.js 16 full-stack app |
| Last updated | 2026-10-05 |

**Contents**

1. [Intent](#1-intent)
2. [Planning](#2-planning)
3. [Requirements](#3-requirements)
4. [Design and architecture](#4-design-and-architecture)
5. [Implementation](#5-implementation)
6. [Testing](#6-testing)
7. [Release and deployment](#7-release-and-deployment)
8. [Operations and maintenance](#8-operations-and-maintenance)
9. [Decision log](#9-decision-log)
10. [Feature template](#10-feature-template)
11. [Change history](#11-change-history)

---

## 1. Intent

### Problem
Learning alone from videos and articles is passive and easy to abandon. Existing tools each cover one piece:
Discord (community, voice), Quizlet/Kahoot (quizzes), Reddit/forums (discussion), course platforms (content).
Nobody combines **content + discussion + quizzes + learning together at the same time** in one place.

### Vision
> **Learning is better together.** Communities gather around a video or an article, talk about it by text or
> voice, test each other with quizzes, and study side by side in real time.

### Target users
| Who | What they need |
|---|---|
| Students | Study groups around course material, quick self-tests |
| Exam preparation groups | Quizzes, leaderboards, live quiz battles for revision |
| Office workers / self-learners | Topic communities, discussing articles and talks, learning with colleagues |

### Product principles
1. **Learning over engagement.** Features should help people understand (instant quiz feedback with
   explanations), not just keep them scrolling.
2. **Together, live.** Prefer real-time experiences: live chat, live battles, study rooms.
3. **Fun, but fair.** XP, streaks and badges reward learning activity, with caps so they can't be farmed.
4. **Safe by default.** Private communities, roles, reporting and moderation from day one.
5. **Free to run.** Everything runs locally on free, open-source software. Paid services only when needed.

### Non-goals (for now)
- Hosting uploaded videos (we embed YouTube instead — cheaper, avoids copyright issues).
- Native iOS/Android apps (the web app is an installable PWA).
- AI features (need a paid API — planned for later).
- Public launch (see the [pre-launch checklist](#pre-launch-checklist-before-opening-to-the-public)).

### Success measures (once there are real users)
Weekly active learners · quizzes completed per user · day-7 / day-30 retention · share of posts that get a
discussion · study rooms and battles per community per week.

---

## 2. Planning

### Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 1 — MVP** | Sign up/login · communities (public/private, roles, invites) · posts (video/article/note) · live discussion · voice notes · quizzes · XP, levels, streaks, badges, profiles, leaderboards · reporting + moderation | ✅ Done |
| **Phase 2 — Learn together, live** | Live quiz battles · study rooms (voice + synced video + chat) · in-app notifications · installable PWA · Discord-style UI | ✅ Done |
| **Phase 3 — Smart and sustainable** | AI quiz generation from a post · discussion summaries · voice-note transcription · better search · paid "Pro" tier | 📋 Planned |
| **Launch** | Everything in the pre-launch checklist, then production hosting | 📋 Planned |

### Constraints
| Constraint | Effect on the plan |
|---|---|
| Must be free to build and test | Open-source stack, local Postgres, no paid APIs |
| Developed on a company laptop; **Docker Desktop is not allowed** (company policy) | No containers; Postgres runs natively via Homebrew. Podman/Colima are the approved alternatives if ever needed |
| Internal testing only for now | Shared from the developer's Mac via a Cloudflare quick tunnel (`npm run share`) |
| One developer + AI assistant | Simple architecture: one app, one database, no separate services |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Spam / abuse when opened to the public | High | High | Add per-user rate limits before launch; reporting + moderation already exist |
| Study-room voice fails on strict networks | Medium | Medium | Add a TURN relay (free tiers from Cloudflare or Metered) |
| Quick tunnel limitations (URL changes each run, ~200 concurrent requests, possible SSE issues) | Medium | Medium | Fine for testing; use a named tunnel, ngrok or real hosting for anything longer-lived |
| Data loss (everything lives on one laptop) | Medium | High | Regular `pg_dump` backups (see [operations](#8-operations-and-maintenance)); move to hosted Postgres at launch |
| Employer policy on side projects / public repo from a work laptop | Unknown | High | Confirm with the employer before publishing or launching |
| YouTube oEmbed is slow/unavailable | Low | Low | Already handled: falls back to the title "YouTube video" |

---

## 3. Requirements

### Functional requirements (by module)

| Module | Requirements |
|---|---|
| **Accounts** | Sign up / log in with email + password; sessions in httpOnly cookies; redirect back to the page you came from (e.g. an invite link) |
| **Communities** | Create public or private; browse/search public ones; join/leave; private ones only via invite link; roles: owner, moderator, member |
| **Posts** | Share a YouTube video (embedded), an article (link-preview card) or a note; each post is a "channel" in the sidebar |
| **Discussion** | Live messages per post; replies with a reference to the original; voice notes (record, send, play, seek); delete own; moderators delete any |
| **Quizzes** | Build multiple-choice quizzes (2–6 answers, explanations), optionally linked to a post; one question at a time with instant feedback; best-score leaderboard |
| **Live battles** | Host from any quiz; lobby; synchronised timed questions; speed-based scoring; reveal with vote counts; podium |
| **Study rooms** | Join a room on any post; peer-to-peer voice with mute; video posts play in sync with the host; chat alongside |
| **Progress** | XP for learning activity, levels, daily streak, badges, profile page, weekly / all-time community leaderboard |
| **Moderation** | Report posts, messages, quizzes; moderator queue grouped per item; remove or dismiss |
| **Notifications** | Live bell for replies, comments on your posts and battles starting; grouped; mark as read |
| **App** | Installable PWA; Discord-style layout; light/dark following the device; works on phones |

### Non-functional requirements

| Area | Requirement | How it is met |
|---|---|---|
| Security | Every mutation checks login **and** permission on the server | Each Server Action / route handler calls `requireUser()` / `auth.api.getSession()` plus a permission check |
| Security | No hidden answers leak to the browser | Quiz/battle answers are only sent after answering / after the reveal |
| Security | No server-side request forgery from link previews | `link-preview.ts` blocks private, loopback and link-local addresses on every redirect |
| Security | Uploaded files are what they claim | Voice notes are checked by file signature (WebM/Ogg/MP4), size ≤ 5 MB, length ≤ 5 min |
| Security | User text can't run as code | All user text is rendered as text by React (no `dangerouslySetInnerHTML`) |
| Security | Headers | `X-Frame-Options: DENY`, `nosniff`, strict referrer, `Permissions-Policy` (mic only for our pages) |
| Privacy | Emails are never shown to other users | Profiles show name, XP, badges and only communities the viewer may see |
| Privacy | Private communities are invisible to non-members | `getCommunityForViewer` / `get*Access` return 404 |
| Realtime | Updates arrive within ~1 s and survive reconnects | SSE + Postgres LISTEN/NOTIFY; clients refetch on every `ready` event |
| Fairness | XP can't be farmed | Daily caps per activity; quiz XP only on first completion |
| Accessibility | Keyboard and screen-reader friendly | Labelled controls, `aria-live` regions, focusable hidden toolbars, colour + shape for battle answers |
| Theming | Matches the device | CSS tokens in `globals.css` with a `prefers-color-scheme` dark set |

---

## 4. Design and architecture

### Technology stack

| Layer | Choice |
|---|---|
| App framework | **Next.js 16** (App Router, Server Components, Server Actions, Route Handlers, `proxy.ts`) |
| Language / UI | TypeScript, React 19, Tailwind CSS v4, lucide-react icons |
| Database | **PostgreSQL 14** (native, via Homebrew) |
| ORM / migrations | **Drizzle ORM** + drizzle-kit (`web/drizzle/` holds SQL migrations) |
| Auth | **Better Auth** (email + password, DB sessions, built-in sign-up rate limit) |
| Validation | zod |
| Realtime | Server-Sent Events + Postgres `LISTEN/NOTIFY` |
| Voice/video together | WebRTC (peer-to-peer mesh) + YouTube IFrame API |
| File storage | Local disk (`web/uploads/`) behind `server/storage.ts` |

### Architecture

```
                    Browser (web / installable PWA)
     ┌──────────────────────┬──────────────────────┬─────────────────────┐
     │ Pages + Server Actions│ SSE streams (live)   │ WebRTC audio         │
     ▼                      ▼                      │ (browser ↔ browser)  │
┌─────────────────────────────────────────────┐   │                      │
│ Next.js server                               │   └── only signalling ──┘
│  • Server Components / Actions (mutations)    │        goes via server
│  • Route handlers (/api/*: SSE, voice, rooms)│
│  • RealtimeHub: one LISTEN connection per    │
│    process → fans events out to SSE streams  │
└──────────────┬──────────────────────────────┘
               │ SQL + NOTIFY / LISTEN
        ┌──────▼──────┐        ┌──────────────┐
        │ PostgreSQL  │        │ uploads/     │ voice notes
        └─────────────┘        └──────────────┘
```

**Realtime flow (example: a chat message)**
1. Browser calls the `sendMessage` Server Action → row inserted.
2. Server runs `pg_notify('learnhub_events', {topic:"post:<id>", type:"message.created", id})`.
3. Every server process's `RealtimeHub` receives it, loads the message once, and pushes it to each open
   SSE stream subscribed to `post:<id>`.
4. Clients add it to the list. On every (re)connect the stream sends `ready`, and clients refetch to catch
   anything missed.

Topics: `post:<id>` (chat), `battle:<id>`, `room:<postId>` (presence, playback, WebRTC signals — signals are
filtered so only the addressee receives them), `user:<id>` (notifications).

### Project structure

```
learnhub/
├── docs/SDLC.md                 this document
├── README.md                    setup and run instructions
└── web/
    ├── drizzle/                 SQL migrations (generated, committed)
    ├── public/                  PWA icons
    ├── scripts/                 share.mjs, reset-password.mjs, generate-icons.mjs
    └── src/
        ├── app/
        │   ├── (auth)/          login, signup
        │   ├── (app)/(home)/    dashboard, browse, create, join, profile, notifications
        │   ├── (app)/c/[slug]/  community: welcome, members, leaderboard, moderation,
        │   │                    new post, p/[postId] (+ /room), quizzes/new, q/[quizId], b/[battleId]
        │   ├── api/             auth, SSE streams, voice upload/stream, battle state, rooms
        │   └── manifest.ts      PWA manifest
        ├── components/          UI (Discussion, QuizRunner, BattleRoom, StudyRoom, shell/…)
        ├── db/schema/           Drizzle tables (one file per area)
        ├── lib/                 auth, session helpers, formatting
        ├── server/              data access, permissions, Server Actions (*-actions.ts), realtime, storage
        └── proxy.ts             fast login redirects (pages still verify on the server)
```

### Data model

| Area | Tables |
|---|---|
| Auth (Better Auth) | `user`, `session`, `account`, `verification` |
| Communities | `community` (slug, visibility, invite code), `community_member` (role) |
| Content | `post` (video/article/note + link preview), `message` (text/voice, reply `parent_id`, soft delete) |
| Quizzes | `quiz`, `quiz_question`, `quiz_option` (`is_correct`), `quiz_attempt`, `quiz_answer` |
| Live battles | `battle` (status, current question, timer), `battle_player` (score), `battle_answer` (points) |
| Study rooms | `room_participant` (presence via heartbeat), `room_playback` (shared position) |
| Progress | `xp_event` (unique per user + kind + ref → idempotent awards) |
| Safety | `report` (unique per reporter + item, status) |
| Notifications | `notification` (grouped by `group_key`, `read_at`) |

All timestamps are `timestamptz`.

### Permission model

| Action | Owner | Moderator | Member | Non-member (public community) |
|---|:-:|:-:|:-:|:-:|
| Read posts, chat, quizzes | ✅ | ✅ | ✅ | ✅ (private: ❌) |
| Post, chat, voice notes, quizzes, battles, rooms | ✅ | ✅ | ✅ | ❌ |
| Delete own content | ✅ | ✅ | ✅ | — |
| Delete others' posts / messages / quizzes | ✅ | ✅ | ❌ | ❌ |
| See invite link, moderation queue | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ (anyone but owner) | ✅ (members only) | ❌ | ❌ |
| Make / unmake moderators | ✅ | ❌ | ❌ | ❌ |
| Report content (not own) | ✅ | ✅ | ✅ | ✅ |

Rules live in `server/communities.ts` (`canManageMembers`, `canRemoveMember`, `canChangeRoles`),
`server/posts.ts` (`canDeletePost`) and `server/quizzes.ts` (`canDeleteQuiz`).

### Game rules

**XP** (`server/xp.ts`) — each award is unique per (user, activity, item); daily caps per activity:

| Activity | XP | Daily cap |
|---|---|---|
| Share a post | 10 | 5 |
| Send a message | 2 | 25 |
| Send a voice note | 3 | 10 |
| Create a quiz | 15 | 3 |
| Complete a quiz (first time only) | 5 + 2 per correct answer | 20 |
| Perfect quiz score (first time) | +10 | 20 |
| Play a live battle | 5 | 10 |
| Win a live battle (needs ≥ 2 players) | 20 | 5 |

Levels: level *n* starts at 50·(n−1)² XP. Streaks count consecutive **UTC** days with any XP.
Badges: First share, Chatterbox, Voice of reason, Quiz maker, Quiz whiz, Perfectionist, Champion, On fire, Scholar.

**Battles** (`server/battles.ts`) — 20 s per question; correct = 500 + up to 500 for speed; reveal when
everyone has answered, when the host clicks, or when time runs out (+1 s grace for latency).

---

## 5. Implementation

### Local setup
See `README.md`. In short: Homebrew Postgres → create `learnhub` DB → `cd web && nvm use && npm install` →
copy `.env.example` to `.env.local` and set `BETTER_AUTH_SECRET` → `npm run db:migrate` → `npm run dev`.

### Commands (`web/package.json`)

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration after changing `src/db/schema` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run share` | Share this machine's app via a Cloudflare quick tunnel |
| `npm run reset-password -- email` | Admin: set a new password (hidden prompt) |

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `BETTER_AUTH_SECRET` | Signs sessions — keep secret, never commit |
| `BETTER_AUTH_URL` | Public URL of the app |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Extra allowed origins (comma-separated); set automatically by `npm run share` |
| `STORAGE_LOCAL_DIR` | Where voice notes are stored (default `./uploads`) |

### Coding conventions (learned the hard way — please keep them)
1. **Every export in a `"use server"` file is a public endpoint.** Each one must check the session and
   permissions itself. Never put read-only helpers that take a `userId` in those files.
2. **Pages verify access on the server** (`requireUser`, `getCommunityForViewer`, `get*Access`).
   `proxy.ts` is only an optimistic redirect.
3. **Validate all input with zod** on the server; return friendly error messages.
4. **Never send secrets to the client before it's time** (quiz correctness, battle answers).
5. **Raw SQL subqueries must be table-qualified** (`${table}.column`). In single-table queries Drizzle leaves
   columns unqualified, which silently compares the wrong columns.
6. **Use `timestamptz`** for every timestamp.
7. **Don't call impure functions (`Date.now()`) during render** — use effects or let the database compute it.
8. **Arrays of Postgres enums** must be cast to `text[]` (node-postgres can't parse enum arrays).
9. **Next.js 16 differs from older versions** — read `web/node_modules/next/dist/docs/` before using an API.
10. **Side effects never break the main action** — XP awards and notifications catch and log their own errors.
11. Match existing style: small server modules, `buttonStyles` / `inputStyles`, theme tokens (`bg-sidebar`,
    `text-muted`…) instead of raw colours.

### Adding a database change
Edit `src/db/schema/*.ts` → `npm run db:generate -- --name short_description` → review the SQL in
`web/drizzle/` → `npm run db:migrate` → commit schema and migration together.

### Git workflow
- One commit per tested feature, with a clear message explaining what and why.
- Commit only after the feature has been tested by a person.
- Never commit `.env*` (except `.env.example`), `uploads/`, `.next/`, `node_modules/`.

---

## 6. Testing

### Definition of done for a feature
1. `npx tsc --noEmit` — no type errors
2. `npm run lint` — no errors or warnings
3. `npm run build` — production build succeeds
4. Browser end-to-end tests pass (multi-user where relevant)
5. Screenshots checked on desktop and phone width, light and dark
6. Manually tested by a person, then committed

### How the end-to-end tests worked
Each feature was verified with scripted browser tests using `playwright-core` driving the installed Google
Chrome (headless), against a production build (`npm run build && npm start`):

- **Multiple users at once** in separate browser contexts (e.g. host + two players for battles).
- **Fake microphone** (`--use-fake-device-for-media-stream`) to test voice notes and WebRTC voice for real.
- **Security checks**: watching network responses for leaked quiz answers, calling APIs as non-members,
  checking that private items return 404, checking headers.
- Test accounts use `@example.com` emails and are deleted afterwards.

| Suite | Checks |
|---|---|
| Communities | 23 |
| Posts | 23 |
| Discussion | 20 |
| Voice notes | 17 |
| Quizzes | 19 |
| XP / profiles / leaderboard | 13 |
| Moderation | 15 |
| Live battles | 19 |
| Study rooms | 16 |
| Notifications + PWA | 15 |
| **Total** | **180+** |

> ⚠️ **Gap:** these test scripts were run from a scratch folder and are **not yet in the repository**. Next
> step: add them under `web/tests/e2e/` with an `npm run test:e2e` command so they can be re-run before every
> release.

### Bugs found by testing (and their lessons)
| Bug | Lesson |
|---|---|
| Password could appear in the URL if the form was submitted before JavaScript loaded | Auth forms use `method="post"` and stay disabled until hydrated |
| New posts showed "in 5 hours" | Store timestamps with time zone |
| Post type reset to "video" after a validation error | React resets forms after actions — keep important state in controlled hidden inputs |
| Chat lost a second message typed while the first was sending | Clear the input immediately, restore on failure |
| Quiz/message counts were 0 in single-table queries | Table-qualify raw subqueries |
| Moderation page crashed on enum arrays | Cast enum arrays to `text[]` |
| Battle question never closed when time ran out | Client must retry after the server's grace period |
| Sidebar didn't show new battles; bell didn't clear | Revalidate the layout, or push a realtime event |
| Deleting a post left voice files on disk | Delete media explicitly; DB cascades don't touch files |

---

## 7. Release and deployment

### Current: internal testing from the developer's Mac
```bash
cd web && npm run share
```
Builds, opens a Cloudflare quick tunnel (`https://….trycloudflare.com`), configures login for that URL and
keeps the Mac awake. The URL changes each run; the app is only up while the command runs.

### Production hosting (when ready)
The app needs a **long-running Node server** (SSE streams + a persistent `LISTEN` connection) and
**persistent file storage**. Serverless platforms (e.g. Vercel) don't fit without rewriting realtime.

| Option | Cost | Notes |
|---|---|---|
| **Railway** (recommended) | ~$5/month | App + Postgres + volume, HTTPS, deploy on `git push`; set root directory to `web` |
| Oracle Cloud Always Free VM | $0 | Node + Postgres + Caddy (HTTPS) set up by script; more maintenance |
| Render free tier | $0 | ❌ Sleeps after 15 min and deletes free DBs after 30 days |

Hosted Postgres note: `LISTEN/NOTIFY` needs a **direct (non-pooled)** connection.

### Pre-launch checklist (before opening to the public)
- [ ] Confirm employer policy allows the project / public repository
- [ ] Production migration script that doesn't need dev dependencies
- [ ] Password reset by email (e.g. Resend free tier) and optionally email verification
- [ ] Per-user rate limits on messages, posts, uploads, reports
- [ ] Privacy Policy and Terms pages, linked from sign-up
- [ ] TURN relay for study-room voice (`ICE_SERVERS` config)
- [ ] File storage on S3 / Cloudflare R2 (replace `server/storage.ts`)
- [ ] Automated daily database backups + a tested restore
- [ ] Error monitoring (e.g. Sentry free tier) and uptime check
- [ ] `BETTER_AUTH_URL` set to the real domain; strong `BETTER_AUTH_SECRET`
- [ ] E2E tests in the repo and passing

### Release steps (per feature, today)
1. Build the feature → definition of done (section 6).
2. Person tests it → commit.
3. `npm run db:migrate` on the target database if the schema changed.
4. Restart `npm run share` (or redeploy).

---

## 8. Operations and maintenance

### Admin tasks
| Task | How |
|---|---|
| Reset a user's password | `npm run reset-password -- user@example.com` (also signs them out everywhere) |
| Look at data | `npm run db:studio` |
| Back up the database | `pg_dump -U learnhub -h localhost learnhub > backup-$(date +%F).sql` |
| Restore | `psql -U learnhub -h localhost learnhub < backup.sql` (into an empty DB) |
| Server logs | Output of `npm start` / `npm run share` |

Passwords are stored as one-way hashes — they can be reset, never read.

### Known limitations / technical debt
- E2E tests not yet in the repo (see section 6).
- No editing of posts or messages (delete and re-share).
- No transfer of community ownership; owners can't leave.
- Removed members keep receiving live chat updates until they reload (they can't send).
- Streaks use UTC days.
- Study rooms are peer-to-peer: best for ≤ ~6 people; no TURN relay yet.
- YouTube is the only video source.
- Better Auth's sign-up rate limit is in-memory (fine for one server).
- Abandoned battle lobbies stay in the database (hidden from "Live now" after 3 hours).

---

## 9. Decision log

Short records of important decisions. Add a new row instead of editing old ones.

| # | Date | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 1 | 2026-10-03 | Web-first with Next.js; installable PWA instead of native apps | One codebase; phones can install it; native can come later (Capacitor/React Native) | Expo / React Native first |
| 2 | 2026-10-03 | No Docker; native Postgres via Homebrew | Company policy forbids Docker Desktop | Podman, Colima |
| 3 | 2026-10-03 | Drop the Java (Spring Boot) backend; Next.js does both UI and backend | One language, faster to build | Separate Spring Boot API; Supabase (its local setup needs Docker) |
| 4 | 2026-10-03 | Better Auth + Drizzle ORM | Free, open source, sessions in our own DB, typed queries | NextAuth/Auth.js, Prisma |
| 5 | 2026-10-04 | Realtime via SSE + Postgres LISTEN/NOTIFY | Works in Next.js route handlers, no extra server or Redis, scales across instances | Socket.io server, Redis pub/sub, hosted Pusher/Ably |
| 6 | 2026-10-04 | Discord-style interface (communities as servers, posts as channels), theme follows the device | Familiar to the target users; fits community learning | Feed/forum layout |
| 7 | 2026-10-04 | Replies as Discord-style references in one timeline | Matches the chat UI; easier to follow live | Nested threads (first version) |
| 8 | 2026-10-04 | Voice notes stored on local disk behind a storage module | Free; easy to swap for S3/R2 later | MinIO, cloud storage now |
| 9 | 2026-10-04 | Quiz answers checked on the server one question at a time | Prevents cheating; enables instant feedback | Send answers to the client |
| 10 | 2026-10-04 | Study rooms use a WebRTC mesh + YouTube IFrame API | Free, no media server | LiveKit server |
| 11 | 2026-10-04 | XP as idempotent events with daily caps | Fair, auditable, can't be farmed | Counter column on the user |
| 12 | 2026-10-05 | Internal testing via Cloudflare quick tunnel from the developer's Mac | Free, HTTPS (needed for the mic), already used by the team | Paid hosting now; LAN-only |
| 13 | 2026-10-05 | Not public yet; public-launch items deferred | Internal testing first | Launch immediately |

---

## 10. Feature template

Copy this into a new section (or a new file under `docs/features/`) before building something new.

```markdown
## Feature: <name>

### 1. Intent
- Problem / user need:
- Who benefits:
- How we'll know it worked:

### 2. Planning
- In scope:
- Out of scope:
- Risks / open questions:
- Decisions needed from: <person>

### 3. Requirements
- Functional:
- Permissions (who can do what):
- Non-functional (security, privacy, performance, accessibility):

### 4. Design
- Data model changes (tables / columns / migration name):
- Server: actions / routes / realtime topics:
- UI: pages / components / states (empty, loading, error, mobile, dark):

### 5. Implementation notes
- Files touched:
- Conventions checked (section 5):

### 6. Testing
- E2E scenarios (incl. multi-user and "not allowed" cases):
- Manual test steps:
- Results:

### 7. Release
- Migration needed? Config/env changes?
- Tested by / date:
- Commit:
```

---

## 11. Change history

| Date | Commit | Change |
|---|---|---|
| 2026-10-03 | `b5b2bbb` | Project setup (Next.js + Spring Boot, later removed) |
| 2026-10-03 | `b910e04` | Switch to full-stack Next.js; email/password auth |
| 2026-10-03 | `f6e9141` | Communities: create, browse, join, roles, invite links |
| 2026-10-03 | `d29aa3c` | Learning posts: videos, articles, notes |
| 2026-10-05 | `03984d9` | Live discussion, Discord-style UI, voice notes, quizzes, XP, moderation, battles, study rooms, notifications, PWA |
| 2026-10-05 | `165f7c7` | Share-for-testing tunnel script; password reset tool |
