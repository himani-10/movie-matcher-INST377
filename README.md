# Movie Matcher

Collaborative movie picking for groups. Create a room, collect everyone's genre/language/runtime/rating preferences, and fetch consensus-friendly movies with trailers, cast, and where-to-watch info.

## Project Overview (Top Half)
- **Description:** Front-end uses Fetch API to create/join rooms, save preferences, and request matched movies. TMDb (discover, details, credits, videos) plus Watchmode (streaming sources) power the recommendations.
- **Target browsers:** Chrome, Firefox, Edge, Safari (last two desktop versions); Safari on iOS 16+ and Chrome on Android 12+ with responsive layouts under 960px.
- **Libraries:** Chart.js (preference visualization) and Swiper (movie carousel). Vanilla HTML/CSS/JS everywhere else.
- **Backend:** Node/Express with Supabase for rooms/preferences + TMDb/Watchmode fetches.
- **Deployment:** Optimized for Vercel static hosting or Node server deploy; CDN libraries keep bundles small.
- **Developer Manual:** See `docs/developer-manual.md`.

---

## Developer Manual (Bottom Half)

### Prerequisites
- Node.js 18+ and npm
- TMDb API key and Watchmode API key
- Supabase project (for rooms, members, preferences, and votes)

### Local setup
1) Clone the repo and install dependencies if/when a server is added:
```bash
npm install
```
2) Create `.env.local` with:
```
TMDB_API_KEY=your_key
WATCHMODE_API_KEY=your_key
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_CONNECTION_STRING=postgresql://postgres:YOUR_PASSWORD@db.your-project.supabase.co:5432/postgres
```
3) Run the Node server (serves API + static frontend):
```bash
npm start
```
4) Visit `http://localhost:3000` (or the port reported).

### Expected API surface
- `POST /api/createRoom` → `{ code }` (create 6-char room, insert into Supabase `rooms`)
- `GET /api/room?roomCode=CODE` → `{ room }` (validate room exists)
- `POST /api/savePreferences` with `{ roomCode, genre, language, max_runtime, min_rating }` → 200 on success (insert into `preferences`)
- `GET /api/match?roomCode=CODE` → `{ movies: [...] }`
  - Combine preferences per room, call TMDb discover, then TMDb details/videos/credits per title, then Watchmode sources; respond with `{ title, poster, overview, rating, runtime, cast[], watch_on[], trailer }`.

### Database sketch (Supabase)
- `rooms(id, code, created_at)`
- `members(id, room_id, name, joined_at)`
- `preferences(id, room_id, member_id, genre, language, max_runtime, min_rating, created_at)`
- `matches(id, room_id, movie_id, created_at)`
- `votes(id, match_id, member_id, vote)` where vote is like/dislike

### Testing
- Add integration tests with mocked TMDb/Watchmode responses for `/api/match`.
- Add unit tests for preference aggregation and room-code validation.

### Known bugs / gaps
- No server code is bundled yet; `/api/*` endpoints must be implemented (Node/Express on Vercel serverless or similar).
- No authentication on rooms; rely on room codes today.

### Roadmap
- Add like/dislike voting on the carousel.
- Persist watchlists per member.
- Add pagination and filters (streaming service selection) before matching.
- Cache TMDb/Watchmode responses to reduce API usage.
