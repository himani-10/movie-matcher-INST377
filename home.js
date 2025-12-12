const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinCodeInput = document.getElementById('joinCodeInput');
const joinRoomInput = document.getElementById('joinRoomInput');
const joinSubmitBtn = document.getElementById('joinSubmitBtn');

// Create Room
createRoomBtn?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/createRoom', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create room');
    const data = await res.json();
    window.location.href = `room.html?roomCode=${encodeURIComponent(data.code)}`;
  } catch (err) {
    console.error(err);
    alert('Could not create a room. Please try again.');
  }
});

// Join Room - Show input field
joinRoomBtn?.addEventListener('click', () => {
  if (joinRoomInput) {
    joinRoomInput.style.display = 'flex';
  }
});

// Submit join room
joinSubmitBtn?.addEventListener('click', async () => {
  const code = joinCodeInput?.value.trim().toUpperCase();
  if (!code) {
    alert('Please enter a room code');
    return;
  }

  try {
    const res = await fetch(`/api/room?roomCode=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error('Room not found');
    window.location.href = `room.html?roomCode=${encodeURIComponent(code)}`;
  } catch (err) {
    console.error(err);
    alert('Room not found. Double-check the code or create a new room.');
  }
});

// Allow Enter key to submit
joinCodeInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinSubmitBtn?.click();
  }
});
