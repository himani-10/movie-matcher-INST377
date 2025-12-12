const params = new URLSearchParams(window.location.search);
const roomCode = (params.get('roomCode') || '').toUpperCase();
const roomCodeText = document.getElementById('roomCodeText');
const roomCodeEchoes = document.querySelectorAll('.roomCodeEcho');
const matchBtn = document.getElementById('matchBtn');
const prefForm = document.getElementById('prefForm');

function setRoomCode(code) {
  const display = code || 'N/A';
  if (roomCodeText) roomCodeText.textContent = display;
  roomCodeEchoes.forEach((node) => { node.textContent = display; });
}

setRoomCode(roomCode);

if (!roomCode && matchBtn) {
  matchBtn.disabled = true;
  matchBtn.textContent = 'Enter via a room link';
}

// Basic genre counts for Chart.js
const genreCounts = { action: 0, comedy: 0, drama: 0 };
let genreChart;

// Initialize chart
function initChart() {
  const ctx = document.getElementById('genreChart');
  if (!ctx) return;
  genreChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Action', 'Comedy', 'Drama'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#fb923c', '#a855f7', '#38bdf8'],
        borderWidth: 0,
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true },
      }
    }
  });
}

function updateChart() {
  if (!genreChart) return;
  genreChart.data.datasets[0].data = [
    genreCounts.action,
    genreCounts.comedy,
    genreCounts.drama,
  ];
  genreChart.update();
}

// Save preferences
prefForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!roomCode) {
    alert('Please join from the home page to get a room code before saving preferences.');
    return;
  }

  const formData = new FormData(e.target);
  const prefs = Object.fromEntries(formData.entries());
  prefs.roomCode = roomCode;

  try {
    const res = await fetch('/api/savePreferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });

    if (!res.ok) throw new Error('Error saving preferences');

    genreCounts[prefs.genre] = (genreCounts[prefs.genre] || 0) + 1;
    updateChart();
  } catch (err) {
    console.error(err);
    alert('Error saving preferences. Double-check your room code or try again.');
  }
});

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

// Match movies
matchBtn?.addEventListener('click', async () => {
  if (!roomCode) {
    alert('Join or create a room first so we can look up your group preferences.');
    return;
  }

  try {
    const res = await fetch(`/api/match?roomCode=${encodeURIComponent(roomCode)}`);
    if (!res.ok) throw new Error('Match request failed');
    const { movies } = await res.json();
    renderMovies(movies);
  } catch (err) {
    console.error(err);
    renderMovies(fallbackMovies);
  }
});

let swiper;

function renderMovies(movies) {
  const container = document.getElementById('moviesContainer');
  container.innerHTML = '';

  if (!movies || movies.length === 0) {
    container.innerHTML = '<div class="swiper-slide"><div class="movie-card"><p>No matches yet. Try updating preferences and hit match again.</p></div></div>';
    return;
  }

  movies.forEach(movie => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    slide.innerHTML = `
      <div class="movie-card">
        <img src="${movie.poster}" alt="${movie.title}">
        <h3>${movie.title}</h3>
        <p>${movie.overview}</p>
        <p>⭐ ${movie.rating} | ${movie.runtime} min</p>
        <p><strong>Cast:</strong> ${movie.cast.join(', ')}</p>
        <p><strong>Watch on:</strong> ${movie.watch_on.join(', ')}</p>
        <a href="${movie.trailer}" target="_blank">Watch Trailer</a>
      </div>
    `;
    container.appendChild(slide);
  });

  if (swiper) swiper.destroy(true, true);
  swiper = new Swiper('.mySwiper', {
    loop: false,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    slidesPerView: 1,
    spaceBetween: 20,
    breakpoints: {
      900: { slidesPerView: 2 },
    },
  });
}

initChart();
