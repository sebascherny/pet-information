# Pet Information

A web app for managing your pets' clinical history and veterinary appointments.

## Features

- **User authentication** — Register, log in, persistent sessions (JWT cookies)
- **Settings & Pets** — Manage profile, store Anthropic or OpenAI API key, register pets
- **Clinical History** — Upload PDF/image files, filter by pet and date, AI summaries (when an API key is set)
- **Appointments** — Schedule vet visits, email reminders 24 hours before

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React, Vite, TypeScript, Tailwind   |
| Backend  | Node.js, Express, TypeScript        |
| Database | PostgreSQL                          |
| Infra    | Docker Compose                      |

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and optionally SMTP credentials
```

### 2. Run with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432

### 3. Local development (without Docker)

**Database** — start PostgreSQL and set `DATABASE_URL` in `.env`.

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable       | Description                              |
|----------------|------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string             |
| `JWT_SECRET`   | Secret for signing session tokens        |
| `SMTP_HOST`    | SMTP server for appointment reminders    |
| `SMTP_PORT`    | SMTP port (default 587)                  |
| `SMTP_USER`    | SMTP username                            |
| `SMTP_PASS`    | SMTP password                            |
| `SMTP_FROM`    | Sender address for reminder emails       |

SMTP is optional in development — reminders are skipped if not configured.

## API Overview

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | `/api/auth/register`        | Create account           |
| POST   | `/api/auth/login`           | Log in                   |
| POST   | `/api/auth/logout`          | Log out                  |
| GET    | `/api/auth/me`              | Current user             |
| PUT    | `/api/users/settings`       | Update profile & API key |
| GET    | `/api/pets`                 | List pets                |
| POST   | `/api/pets`                 | Create pet               |
| GET    | `/api/files`                | List files (with filters)|
| POST   | `/api/files`                | Upload file              |
| GET    | `/api/appointments`         | List appointments        |
| POST   | `/api/appointments`         | Create appointment       |

All endpoints except auth require a valid session cookie.
