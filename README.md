# Qula IMS

Internal invoicing and project management system.

## Requirements

- Node.js 20 or newer
- A Postgres database

## Setup

1. Install dependencies.

```
npm install
```

2. Copy the env file and fill it in.

```
cp .env.example .env
```

At minimum you need `DATABASE_URL` and `RESEND_API_KEY`. File uploads
(profile pictures, QR codes, signatures) work without any setup and are
saved locally to `public/uploads`. To use Cloudflare R2 instead, fill in
the `R2_*` variables in `.env`.

3. Run the database migrations.

```
npm run db:migrate
```

4. Seed the database with starter data.

```
npm run db:seed
```

5. Start the dev server.

```
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | Run the linter |
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:seed` | Seed the database with starter data |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

## Project structure

```
app/        Pages and API routes
components/ Shared UI components
db/         Database schema, migrations, seed script
lib/        Shared logic (auth, storage, validation, etc)
docs/       Planning docs
```

## File storage

Uploads use Cloudflare R2 in production. If the R2 env variables are not
set, uploads are saved to public/uploads on disk instead. This works for
local development but not for production, since that folder does not
persist across deploys.

## Docs

See the docs folder for the phased build plan and client requests.
