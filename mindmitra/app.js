/*
 * Caregiver Dashboard
 * Links to a patient via the pairing code the patient shares from their app's
 * Settings screen, then shows their live location on a map whenever sharing is on.
 */
const API_BASE = window.MINDMITRA_API_BASE || 'http://localhost:4000';

const linkScreen = document.getElementById('linkScreen');
const dashScreen = document.getElementById('dashScreen');
const linkForm = document.getElementById('linkForm');
const linkError = document.getElementById('linkError');

let caregiver = JSON.parse(localStorage.getItem('mindmitra_caregiver') || 'null');
let map, marker, socket;

async function apiCall(path, opts = {}){
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
  return data;
}

linkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  linkError.textContent = '';
  const name = document.getElementById('cgName').value.trim();
  const relation = document.getElementById('cgRelation').value.trim();
  const phone = document.getElementById('cgPhone').value.trim();
  const pairingCode = document.getElementById('cgCode').value.trim();
  try{
    const data = await apiCall('/api/caregivers/link', {
      method: 'POST',
      body: JSON.stringify({ name, relation, phone, pairingCode }),
    });
    caregiver = { id: data.caregiverId, token: data.token, patientName: data.patient.name };
    localStorage.setItem('mindmitra_caregiver', JSON.stringify(caregiver));
    showDashboard();
  }catch(err){
    linkError.textContent = err.message;
  }
});

document.getElementById('signOutBtn').addEventListener('click', () => {
  localStorage.removeItem('mindmitra_caregiver');
  caregiver = null;
  if(socket) socket.disconnect();
  dashScreen.style.display = 'none';
  linkScreen.style.display = 'flex';
});

function initMap(){
  map = L.map('map').setView([20.5937, 78.9629], 5); // default: India, zoomed out until we get a real point
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
}

function updateMap(point){
  if(!map) initMap();
  const latlng = [point.lat, point.lng];
  if(!marker){
    marker = L.marker(latlng).addTo(map);
    map.setView(latlng, 16);
  } else {
    marker.setLatLng(latlng);
    map.panTo(latlng);
  }
  document.getElementById('lastUpdate').textContent =
    'Updated ' + new Date(point.timestamp).toLocaleTimeString() + (point.accuracy ? ' · ±' + Math.round(point.accuracy) + 'm' : '');
  const link = document.getElementById('openInMaps');
  link.href = `https://www.google.com/maps?q=${point.lat},${point.lng}`;
  link.style.display = 'inline-block';
}

function setSharingUI(enabled){
  const dot = document.getElementById('sharingStatus');
  const banner = document.getElementById('offBanner');
  dot.className = 'status-dot ' + (enabled ? 'on' : 'off');
  banner.style.display = enabled ? 'none' : 'block';
}

async function loadCurrent(){
  try{
    const data = await apiCall('/api/location/current', { headers: { Authorization: 'Bearer ' + caregiver.token } });
    document.getElementById('patientName').textContent = data.patientName;
    setSharingUI(true);
    if(data.current) updateMap(data.current);
  }catch(err){
    if(err.message.includes('turned off')){
      setSharingUI(false);
    } else {
      console.warn('Could not load current location:', err.message);
    }
  }
}

function connectSocket(){
  socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  socket.on('connect', async () => {
    try{
      const me = await apiCall('/api/caregivers/me', { headers: { Authorization: 'Bearer ' + caregiver.token } });
      if(me.patient){
        document.getElementById('patientName').textContent = me.patient.name;
        socket.emit('join-patient-room', { patientId: me.patient.id });
      }
    }catch(err){ console.warn(err.message); }
  });
  socket.on('location-update', (point) => { setSharingUI(true); updateMap(point); });
  socket.on('sharing-changed', ({ enabled }) => setSharingUI(enabled));
}

function showDashboard(){
  linkScreen.style.display = 'none';
  dashScreen.style.display = 'flex';
  document.getElementById('patientName').textContent = caregiver.patientName || '—';
  initMap();
  loadCurrent();
  connectSocket();
  // Fallback polling in case the socket connection drops — keeps the dashboard useful either way.
  setInterval(loadCurrent, 20000);
}

if(caregiver){ showDashboard(); }