const params = new URLSearchParams(window.location.search);
const roomCode = params.get('roomCode');
document.getElementById('roomCodeText').textContent = roomCode;

// Basic genre counts for Chart.js
const genreCounts = { action: 0, comedy: 0, drama: 0 };
let genreChart;

// Initialize chart
function initChart() {
  const ctx = document.getElementById('genreChart');
  genreChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Action', 'Comedy', 'Drama'],
      datasets: [{
        data: [0, 0, 0],
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
      }
    }
  });
}

function updateChart() {
  genreChart.data.datasets[0].data = [
    genreCounts.action,
    genreCounts.comedy,
    genreCounts.drama
  ];
  genreChart.update();
}

// Save preferences
document.getElementById('prefForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const prefs = Object.fromEntries(formData.entries());
  prefs.roomCode = roomCode;

  const res = await fetch('/api/savePreferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });

  if (!res.ok) {
    alert('Error saving preferences');
    return;
  }

  // update local genre counts for chart
  genreCounts[prefs.genre] = (genreCounts[prefs.genre] || 0) + 1;
  updateChart();
});

// Match movies
document.getElementById('matchBtn').addEventListener('click', async () => {
  const res = await fetch(`/api/match?roomCode=${encodeURIComponent(roomCode)}`);
  const { movies } = await res.json();
  renderMovies(movies);
});

let swiper;

function renderMovies(movies) {
  const container = document.getElementById('moviesContainer');
  container.innerHTML = '';

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
  });
}

initChart();