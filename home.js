// Create Room
document.getElementById('createRoomBtn').addEventListener('click', async () => {
  const res = await fetch('/api/createRoom', { method: 'POST' });
  const data = await res.json();
  // redirect to room with code
  window.location.href = `room.html?roomCode=${encodeURIComponent(data.code)}`;
});

// Join Room
document.getElementById('joinRoomBtn').addEventListener('click', async () => {
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
  if (!code) return;
  const res = await fetch(`/api/room?roomCode=${encodeURIComponent(code)}`);
  if (res.ok) {
    window.location.href = `room.html?roomCode=${encodeURIComponent(code)}`;
  } else {
    alert('Room not found');
  }
});