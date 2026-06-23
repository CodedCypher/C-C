
_________ .__                     .__  __    __________               __            
\_   ___ \|__|______   ____  __ __|__|/  |_  \______   \ ____   ____ |  | __  ______
/    \  \/|  \_  __ \_/ ___\|  |  \  \   __\  |       _//  _ \_/ ___\|  |/ / /  ___/
\     \___|  ||  | \/\  \___|  |  /  ||  |    |    |   (  <_> )  \___|    <  \___ \ 
 \______  /__||__|    \___  >____/|__||__|    |____|_  /\____/ \___  >__|_ \/____  >
        \/                \/                         \/            \/     \/     \/ 
  NestJS 11  +  React 19  +  PostgreSQL 16  +  Prisma 7


================================================================================

# Circuit Rocks

A full-stack admin platform built with **NestJS** on the backend and **React**
on the frontend. It covers products, inventory, orders, branches, warehouses,
and a built-in dashboard — all secured with JWT auth and optional Google OAuth.

---

## Tech Stack

| Layer     | Technology                                         |
|-----------|----------------------------------------------------|
| Backend   | NestJS 11, Prisma 7, PostgreSQL 16, Passport JWT   |
| Frontend  | React 19, TanStack Router, TanStack Query, Vite 8  |
| Styling   | Tailwind CSS 4                                     |
| Container | Docker (database only)                             |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) — for the database container
- [Node.js](https://nodejs.org/) v20 or later
- [pnpm](https://pnpm.io/installation) — package manager used by both projects

---

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Start the database

Docker Compose runs only the PostgreSQL instance. The backend and frontend run
natively on your machine for a proper development experience with hot reload.

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container (`circuit-pg`) on port **5433** and keeps
it running in the background.

### 3. Configure the backend

Copy the example env file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

At minimum, generate and set a strong `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output after `JWT_ACCESS_SECRET=` in `backend/.env`. The
`DATABASE_URL` in the example already points to the Docker container on
port 5433 — update it if your setup differs.

Google OAuth is optional. The app boots and all non-Google auth routes work
without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set. See [SETUP.md](./SETUP.md)
for full Google OAuth configuration instructions.

### 4. Install dependencies and run the backend

```bash
cd backend
pnpm install
pnpm start:dev
```

The API will be available at `http://localhost:3000` with watch mode enabled.

First-time only — apply migrations and optionally load demo data:

```bash
pnpm prisma migrate deploy
pnpm seed:demo     # optional demo data
```

### 5. Install dependencies and run the frontend

In a separate terminal:

```bash
cd frontend
pnpm install
pnpm dev
```

The app will be available at `http://localhost:5173` with Vite HMR enabled.

---

## Services at a Glance

| Service    | How it runs        | Default URL / Port          |
|------------|--------------------|-----------------------------|
| PostgreSQL | Docker Compose     | localhost:**5433**          |
| API        | `pnpm start:dev`   | http://localhost:**3000**   |
| Frontend   | `pnpm dev`         | http://localhost:**5173**   |

---

## Stopping the Database

```bash
docker compose down
```

To also delete all stored data (wipes the volume):

```bash
docker compose down -v
```

---

## Project Structure

```
.
├── backend/           NestJS 11 API (port 3000)
│   ├── prisma/        Schema, migrations, seeds
│   └── src/
│       ├── auth/      JWT + Google OAuth
│       ├── products/  Products, brands, categories
│       ├── inventory/ Stock management
│       ├── orders/    Order lifecycle
│       ├── branches/  Branch management
│       ├── warehouses/Warehouse management
│       └── dashboard/ Aggregate metrics
│
├── frontend/          React 19 SPA (port 5173)
│   └── app/
│       ├── features/  Domain modules (auth, products, orders …)
│       ├── components/Shared UI and primitives
│       └── lib/       Axios instance, query client
│
├── docker-compose.yml PostgreSQL database container
├── SETUP.md           Google OAuth step-by-step guide
└── CLAUDE.md          Architecture reference for AI assistants
```

---

## Configuration Reference

### Backend (`backend/.env`)

| Variable               | Required          | Description                                              |
|------------------------|-------------------|----------------------------------------------------------|
| `DATABASE_URL`         | Yes               | PostgreSQL connection string for the main database       |
| `SHADOW_DATABASE_URL`  | Migrations only   | Shadow database used by `prisma migrate dev`             |
| `JWT_ACCESS_SECRET`    | Yes               | 64-char hex secret for signing 15-minute access JWTs     |
| `GOOGLE_CLIENT_ID`     | For Google login  | OAuth 2.0 Client ID from Google Cloud Console            |
| `GOOGLE_CLIENT_SECRET` | For Google login  | OAuth 2.0 Client secret from Google Cloud Console        |
| `GOOGLE_CALLBACK_URL`  | Has default       | Defaults to `http://localhost:3000/auth/google/callback` |
| `FRONTEND_URL`         | Has default       | CORS origin and post-login redirect, default `http://localhost:5173` |

### Frontend (`frontend/.env`)

| Variable       | Required | Description                                           |
|----------------|----------|-------------------------------------------------------|
| `VITE_API_URL` | No       | Backend base URL, defaults to `http://localhost:3000` |

---

## Auth Overview

- **Access token** — signed JWT, 15-minute lifetime, delivered as `cr_at` httpOnly cookie.
- **Refresh token** — 7-day opaque token, delivered as `cr_rt` httpOnly cookie; only its SHA-256 hash is stored in the database. Rotated on every `/auth/refresh` call.
- **Google OAuth** — optional. See [SETUP.md](./SETUP.md) for full setup instructions.

---

## License

This project is private and unlicensed. All rights reserved.
