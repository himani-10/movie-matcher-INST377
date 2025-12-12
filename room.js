const params = new URLSearchParams(window.location.search);
const roomCode = (params.get('roomCode') || '').toUpperCase();
const roomCodeText = document.getElementById('roomCodeText');
const roomCodeEchoes = document.querySelectorAll('.roomCodeEcho');
const matchBtn = document.getElementById('matchBtn');
const submitPrefsBtn = document.getElementById('submitPrefsBtn');
const prefForm = document.getElementById('prefForm');
const preferenceCountEl = document.getElementById('preferenceCount');

function setRoomCode(code) {
  const display = code || 'N/A';
  if (roomCodeText) roomCodeText.textContent = display;
  roomCodeEchoes.forEach((node) => { node.textContent = display; });
}

setRoomCode(roomCode);

if (!roomCode) {
  if (matchBtn) {
    matchBtn.disabled = true;
    matchBtn.textContent = 'Enter via a room link';
  }
  if (submitPrefsBtn) {
    submitPrefsBtn.disabled = true;
  }
}

// Fetch and update preference count
async function updatePreferenceCount() {
  if (!roomCode || roomCode === 'N/A') {
    if (preferenceCountEl) {
      preferenceCountEl.textContent = '0';
    }
    return;
  }
  
  try {
    const res = await fetch(`/api/room?roomCode=${encodeURIComponent(roomCode)}`);
    if (res.ok) {
      const data = await res.json();
      const count = data.preferenceCount !== undefined ? data.preferenceCount : 0;
      if (preferenceCountEl) {
        preferenceCountEl.textContent = count;
      }
    } else {
      console.warn('Failed to fetch preference count:', res.status);
    }
  } catch (err) {
    console.error('Error fetching preference count:', err);
  }
}

// Save preferences without matching
async function savePreferences() {
  if (!roomCode) {
    alert('Join or create a room first.');
    return;
  }

  if (!prefForm) return;

  const formData = new FormData(prefForm);
  const prefs = Object.fromEntries(formData.entries());
  prefs.roomCode = roomCode;

  try {
    const res = await fetch('/api/savePreferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });

    if (res.ok) {
      // Show success feedback
      if (submitPrefsBtn) {
        const originalText = submitPrefsBtn.textContent;
        submitPrefsBtn.textContent = '✓ Saved!';
        submitPrefsBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        setTimeout(() => {
          submitPrefsBtn.textContent = originalText;
          submitPrefsBtn.style.background = '';
        }, 2000);
      }
      // Update preference count
      await updatePreferenceCount();
    } else {
      throw new Error('Failed to save preferences');
    }
  } catch (err) {
    console.error('Error saving preferences:', err);
    alert('Error saving preferences. Please try again.');
  }
}

// Submit preferences button
submitPrefsBtn?.addEventListener('click', savePreferences);

// Load preference count on page load (after a short delay to ensure roomCode is set)
setTimeout(() => {
  updatePreferenceCount();
  // Refresh periodically every 3 seconds (more responsive)
  setInterval(updatePreferenceCount, 3000);
}, 500);

// Preferences are saved when MATCH! button is clicked

const fallbackMovies = [
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

// Loading state management
let isMatching = false;

function setLoadingState(loading) {
  isMatching = loading;
  if (!matchBtn) return;
  
  if (loading) {
    matchBtn.disabled = true;
    matchBtn.innerHTML = '<span class="loader"></span> Finding Movies...';
    matchBtn.classList.add('loading');
  } else {
    matchBtn.disabled = false;
    matchBtn.innerHTML = 'MATCH!';
    matchBtn.classList.remove('loading');
  }
}

// Match movies - triggered by MATCH button
matchBtn?.addEventListener('click', async () => {
  if (!roomCode) {
    alert('Join or create a room first so we can look up your group preferences.');
    return;
  }

  // Prevent multiple simultaneous requests
  if (isMatching) {
    return;
  }

  setLoadingState(true);
  showLoadingState();

  try {
    // First save current form preferences (without showing the success message)
    if (prefForm) {
      const formData = new FormData(prefForm);
      const prefs = Object.fromEntries(formData.entries());
      prefs.roomCode = roomCode;

      try {
        await fetch('/api/savePreferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefs),
        });
        // Update count after saving
        await updatePreferenceCount();
      } catch (err) {
        console.error('Error saving preferences:', err);
      }
    }

    // Then fetch matches (which aggregates all preferences in the room)
    const res = await fetch(`/api/match?roomCode=${encodeURIComponent(roomCode)}`);
    if (!res.ok) throw new Error('Match request failed');
    const data = await res.json();
    const { movies, preferenceCount } = data;
    
    // Update preference count display from match response
    if (preferenceCountEl && preferenceCount !== undefined) {
      preferenceCountEl.textContent = preferenceCount;
    }
    
    renderMovies(movies);
  } catch (err) {
    console.error(err);
    renderMovies(fallbackMovies);
  } finally {
    setLoadingState(false);
  }
});

function showLoadingState() {
  const container = document.getElementById('moviesContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Finding the perfect movies for your group...</p>
    </div>
  `;
}

function renderMovies(movies) {
  const container = document.getElementById('moviesContainer');
  if (!container) return;
  
  container.innerHTML = '';

  if (!movies || movies.length === 0) {
    container.innerHTML = '<div class="movie-rec-card"><p>No matches yet. Make sure multiple people have submitted preferences, then hit MATCH!</p></div>';
    return;
  }

  // Render as stacked cards (not swiper)
  movies.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-rec-card';
    card.innerHTML = `
      <img src="${movie.poster || ''}" alt="${movie.title}" onerror="this.style.display='none'">
      <div class="movie-rec-content">
        <h3>${movie.title}</h3>
        <p>${movie.overview || 'No description available.'}</p>
        <div class="movie-rec-meta">
          <span>⭐ ${movie.rating || 'N/A'}</span>
          <span>⏱ ${movie.runtime || 'N/A'} min</span>
          ${movie.watch_on && movie.watch_on.length > 0 ? `<span>📺 ${movie.watch_on.join(', ')}</span>` : ''}
        </div>
        ${movie.cast && movie.cast.length > 0 ? `<p style="margin-top: 0.5rem; font-size: 0.85rem;"><strong>Cast:</strong> ${movie.cast.slice(0, 3).join(', ')}</p>` : ''}
        ${movie.trailer ? `<a href="${movie.trailer}" target="_blank" style="display: inline-block; margin-top: 0.75rem; color: var(--accent-2);">Watch Trailer →</a>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

// Removed initChart() - no longer needed
