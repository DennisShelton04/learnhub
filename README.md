# LearnHub

Community learning platform: communities share videos and articles, discuss them by text and voice notes, and quiz each other.

```
learnhub/
├── frontend/   Next.js 16 (TypeScript, Tailwind) — web + PWA
└── backend/    Spring Boot 4 (Java 21+, Maven) — REST API + WebSocket
```

Runs fully locally, no Docker required.

## Prerequisites (macOS)

```bash
brew install postgresql@14 redis maven
nvm install 22            # Node 22 (see .nvmrc)
brew services start postgresql@14
brew services start redis
```

One-time database setup:

```bash
createuser learnhub
psql -d postgres -c "ALTER USER learnhub WITH PASSWORD 'learnhub';"
createdb -O learnhub learnhub
```

## Run

Backend (http://localhost:8080):

```bash
cd backend
./mvnw spring-boot:run
```

Frontend (http://localhost:3000):

```bash
cd frontend
nvm use
npm install
npm run dev
```

The home page shows a "Backend connected" badge when both are running.

## Configuration

Backend settings are in `backend/src/main/resources/application.yml` and can be overridden with env vars:
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`, `CORS_ALLOWED_ORIGINS`, `STORAGE_LOCAL_DIR`.

Frontend: copy `frontend/.env.example` to `frontend/.env.local` (`NEXT_PUBLIC_API_URL`).

Database schema changes go in `backend/src/main/resources/db/migration` as Flyway migrations (`V1__description.sql`, ...).
