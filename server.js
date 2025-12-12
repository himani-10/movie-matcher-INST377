const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Client: PgClient } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const {
  TMDB_API_KEY,
  WATCHMODE_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_CONNECTION_STRING,
} = process.env;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const GENRE_MAP = {
  action: 28,
  comedy: 35,
  drama: 18,
};

const FALLBACK_MOVIES = [
  {
    poster: 'https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg',
    title: 'Spider-Man: Into the Spider-Verse',
    overview: 'Miles Morales becomes the Spider-Man of his reality while crossing paths with counterparts from other dimensions.',
    rating: 8.4,
    runtime: 117,
    cast: ['Shameik Moore', 'Hailee Steinfeld', 'Mahershala Ali'],
    watch_on: ['Netflix', 'Apple TV', 'Amazon'],
    trailer: 'https://www.youtube.com/watch?v=g4Hbz2jLxvQ',
  },
  {
    poster: 'https://image.tmdb.org/t/p/w500/6JjfSchsU6daXk2AKX8EEBjO3Fm.jpg',
    title: 'Everything Everywhere All at Once',
    overview: 'An unexpected multiverse romp where an exhausted laundromat owner becomes humanity\'s unlikely hero.',
    rating: 8.0,
    runtime: 139,
    cast: ['Michelle Yeoh', 'Ke Huy Quan', 'Stephanie Hsu'],
    watch_on: ['Showtime', 'Prime Video', 'Apple TV'],
    trailer: 'https://www.youtube.com/watch?v=wxN1T1uxQ2g',
  },
];

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, supabase: Boolean(supabase), tmdb: Boolean(TMDB_API_KEY), watchmode: Boolean(WATCHMODE_API_KEY) });
});

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function ensureTables() {
  if (!SUPABASE_CONNECTION_STRING) {
    console.log('SUPABASE_CONNECTION_STRING not set; skipping automatic DDL.');
    return;
  }

  const client = new PgClient({
    connectionString: SUPABASE_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('create extension if not exists "uuid-ossp";');
    await client.query('create extension if not exists "pgcrypto";');
    await client.query(`
      create table if not exists rooms (
        id uuid default gen_random_uuid() primary key,
        code text unique not null,
        created_at timestamptz default now()
      );
    `);
    await client.query(`
      create table if not exists preferences (
        id uuid default gen_random_uuid() primary key,
        room_id uuid references rooms(id) on delete cascade,
        genre text,
        language text,
        max_runtime int,
        min_rating numeric,
        created_at timestamptz default now()
      );
    `);
    console.log('Supabase tables ensured (rooms, preferences).');
  } catch (err) {
    console.error('Error ensuring tables:', err.message);
  } finally {
    await client.end();
  }
}

function pickTop(counts, fallback) {
  let top = fallback;
  let max = 0;
  Object.entries(counts).forEach(([key, value]) => {
    if (value > max) {
      top = key;
      max = value;
    }
  });
  return top;
}

function aggregatePreferences(prefRows) {
  if (!prefRows || prefRows.length === 0) {
    return {
      genre: 'action',
      language: 'en',
      max_runtime: 140,
      min_rating: 7,
    };
  }

  const genreCounts = {};
  const languageCounts = {};
  const runtimes = [];
  const ratings = [];

  prefRows.forEach((p) => {
    if (p.genre) genreCounts[p.genre] = (genreCounts[p.genre] || 0) + 1;
    if (p.language) languageCounts[p.language] = (languageCounts[p.language] || 0) + 1;
    if (p.max_runtime) runtimes.push(Number(p.max_runtime));
    if (p.min_rating) ratings.push(Number(p.min_rating));
  });

  const genre = pickTop(genreCounts, 'action');
  const language = pickTop(languageCounts, 'en');
  const max_runtime = runtimes.length ? Math.min(...runtimes) : 140;
  const min_rating = ratings.length ? Math.max(...ratings) : 7;

  return { genre, language, max_runtime, min_rating };
}

async function fetchDiscoverMovies(filters) {
  if (!TMDB_API_KEY) throw new Error('TMDb key missing');

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    sort_by: 'popularity.desc',
    'vote_average.gte': filters.min_rating,
    include_adult: 'false',
    with_original_language: filters.language,
  });

  if (filters.max_runtime) params.set('with_runtime.lte', filters.max_runtime);
  const tmdbGenre = GENRE_MAP[filters.genre];
  if (tmdbGenre) params.set('with_genres', tmdbGenre.toString());

  const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb discover failed (${res.status})`);
  const data = await res.json();
  return data.results?.slice(0, 6) || [];
}

async function fetchMovieDetails(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb details failed (${res.status})`);
  return res.json();
}

async function fetchWatchmodeSources(tmdbId) {
  if (!WATCHMODE_API_KEY) return [];

  try {
    const searchUrl = `https://api.watchmode.com/v1/search/?apiKey=${WATCHMODE_API_KEY}&search_field=tmdb_id&search_value=${tmdbId}&types=movie`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error('Watchmode search failed');
    const searchData = await searchRes.json();
    const wmId = searchData?.title_results?.[0]?.id;
    if (!wmId) return [];

    const srcUrl = `https://api.watchmode.com/v1/title/${wmId}/sources/?apiKey=${WATCHMODE_API_KEY}`;
    const srcRes = await fetch(srcUrl);
    if (!srcRes.ok) throw new Error('Watchmode sources failed');
    const sources = await srcRes.json();
    const names = sources
      .filter((s) => ['sub', 'free', 'rent', 'buy'].includes(s.type))
      .map((s) => s.name);
    return [...new Set(names)].slice(0, 5);
  } catch (err) {
    console.error('Watchmode error:', err.message);
    return [];
  }
}

function extractTrailer(videos) {
  const trailer = videos?.results?.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.key
  );
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
}

app.post('/api/createRoom', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  let attempt = 0;
  let code;
  let error;

  while (attempt < 5) {
    code = generateRoomCode();
    const { error: insertError } = await supabase.from('rooms').insert({ code });
    if (!insertError) {
      return res.json({ code });
    }
    error = insertError;
    attempt += 1;
  }

  return res.status(500).json({ error: error?.message || 'Failed to create room' });
});

app.get('/api/room', async (req, res) => {
  const code = (req.query.roomCode || '').toUpperCase();
  if (!code) return res.status(400).json({ error: 'roomCode required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single();
  if (error || !data) return res.status(404).json({ error: 'Room not found' });
  return res.json({ room: data });
});

app.post('/api/savePreferences', async (req, res) => {
  const {
    roomCode,
    genre,
    language,
    max_runtime,
    min_rating,
  } = req.body || {};

  if (!roomCode) return res.status(400).json({ error: 'roomCode required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id')
    .eq('code', roomCode.toUpperCase())
    .single();

  if (roomErr || !room) return res.status(404).json({ error: 'Room not found' });

  const insertPayload = {
    room_id: room.id,
    genre: genre || null,
    language: language || null,
    max_runtime: max_runtime ? Number(max_runtime) : null,
    min_rating: min_rating ? Number(min_rating) : null,
  };

  const { error } = await supabase.from('preferences').insert(insertPayload);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

app.get('/api/match', async (req, res) => {
  const code = (req.query.roomCode || '').toUpperCase();
  if (!code) return res.status(400).json({ error: 'roomCode required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured', movies: FALLBACK_MOVIES });

  try {
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', code)
      .single();
    if (roomErr || !room) return res.status(404).json({ error: 'Room not found' });

    const { data: prefs, error: prefErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('room_id', room.id);

    if (prefErr) throw prefErr;

    const filters = aggregatePreferences(prefs);
    const discovered = await fetchDiscoverMovies(filters);

    const detailed = await Promise.all(
      discovered.map(async (movie) => {
        try {
          const detail = await fetchMovieDetails(movie.id);
          const watch_on = await fetchWatchmodeSources(movie.id);
          return {
            title: detail.title,
            poster: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : '',
            overview: detail.overview || '',
            rating: detail.vote_average || movie.vote_average || 0,
            runtime: detail.runtime || movie.runtime || filters.max_runtime,
            cast: (detail.credits?.cast || []).slice(0, 5).map((c) => c.name),
            watch_on,
            trailer: extractTrailer(detail.videos),
          };
        } catch (err) {
          console.error('Detail fetch error:', err.message);
          return null;
        }
      })
    );

    const movies = detailed.filter(Boolean);
    if (movies.length === 0) return res.json({ movies: FALLBACK_MOVIES });

    return res.json({ movies });
  } catch (err) {
    console.error('Match error:', err.message);
    return res.json({ movies: FALLBACK_MOVIES });
  }
});

app.listen(PORT, async () => {
  await ensureTables();
  console.log(`Server listening on http://localhost:${PORT}`);
});
