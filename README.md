# LearnHub

Community learning platform: communities share videos and articles, discuss them by text and voice notes, and quiz each other.

```
learnhub/
└── web/    Next.js 16 full-stack app (TypeScript, Tailwind, Drizzle ORM, Better Auth)
```

Runs fully locally, no Docker required.

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

## Database

- Schema lives in `web/src/db/schema/` (Drizzle).
- After changing the schema: `npm run db:generate` (creates a migration in `web/drizzle/`), then `npm run db:migrate`.
- `npm run db:studio` opens a browser UI to inspect data.

## Auth

Email + password via [Better Auth](https://www.better-auth.com). Sessions are stored in Postgres and sent as an httpOnly cookie.

- Server: `web/src/lib/auth.ts`, API mounted at `/api/auth/*`
- Client: `web/src/lib/auth-client.ts`
- Protected pages check the session on the server (`auth.api.getSession`); `web/src/proxy.ts` only does fast redirects.
