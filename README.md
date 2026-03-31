# Stride

A personal productivity app for managing tasks, ideas, principles, vision, and a daily journal — all in one place.

## Features

- **Tasks** — Daily task management with focus priorities (max 3/day), date navigation, carryover tracking, and weekly summaries
- **Ideas** — Capture ideas, star favorites, archive old ones, and convert them into tasks
- **Principles** — Define and track your core beliefs
- **Vision** — Set goals with time horizons (3 months to 10 years)
- **Journal** — Continuous scrollable journal with auto-save and markdown download
- **Weekly Reviews** — Reflect on wins, blockers, and next focus areas
- **Search** — Full-text search across all your data
- **Export** — Download everything as a markdown file
- **Authentication** — Google sign-in via Firebase with per-user data isolation

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Backend**: Node.js + Express
- **Database**: Turso (libSQL / SQLite)
- **Auth**: Firebase Authentication (Google provider)
- **Hosting**: Vercel (serverless)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Turso](https://turso.tech) database
- A [Firebase](https://console.firebase.google.com) project with Google sign-in enabled

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/felixbaumgartner/Stride.git
   cd Stride
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```env
   # Turso Database
   TURSO_DATABASE_URL=libsql://your-db.turso.io
   TURSO_AUTH_TOKEN=your-turso-token

   # Firebase (frontend config)
   FIREBASE_API_KEY=your-api-key
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id

   # Firebase Admin (backend - from service account JSON)
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

4. Run the dev server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

### Deploy to Vercel

1. Add all environment variables to your Vercel project settings
2. Deploy:
   ```bash
   npx vercel --prod
   ```
3. Add your Vercel domain to Firebase authorized domains:
   Firebase Console > Authentication > Settings > Authorized domains

## Project Structure

```
Stride/
  middleware/
    auth.js           # Firebase token verification
  public/
    js/
      auth.js         # Firebase client-side auth
      api.js          # API request layer
      app.js          # App initialization and routing
      tasks.js        # Tasks tab module
      ideas.js        # Ideas tab module
      principles.js   # Principles tab module
      vision.js       # Vision tab module
      docs.js         # Journal tab module
      utils.js        # Date utilities and helpers
    index.html        # Single-page app shell
    style.css         # All styles
  routes/
    tasks.js          # /api/tasks endpoints
    ideas.js          # /api/ideas endpoints
    principles.js     # /api/principles endpoints
    vision.js         # /api/vision endpoints
    docs.js           # /api/docs endpoints
    summary.js        # /api/summary endpoints
    export.js         # /api/export endpoint
    search.js         # /api/search endpoint
  db.js               # Database schema and query helpers
  server.js           # Express server entry point
  date-utils.js       # ISO week and date calculations
  vercel.json         # Vercel deployment config
```

## API Endpoints

All endpoints (except `/api/health` and `/api/config`) require a Firebase auth token in the `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (filter by date) |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/ideas` | List ideas |
| POST | `/api/ideas/:id/convert` | Convert idea to task |
| GET | `/api/principles` | List principles |
| GET | `/api/vision` | List vision entries |
| GET | `/api/docs` | List journal entries |
| GET | `/api/summary` | Weekly summary stats |
| GET | `/api/search?q=` | Search across all data |
| GET | `/api/export` | Export all data as markdown |

## License

MIT
