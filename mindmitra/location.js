const express = require('express');
const { load, save } = require('../db');
const { requirePatientAuth, requireCaregiverAuth } = require('../middleware/auth');

const router = express.Router();
const MAX_HISTORY_POINTS = 200;

// The patient app calls this every time it gets a fresh GPS fix while sharing is on.
router.post('/ping', requirePatientAuth, (req, res) => {
  const { lat, lng, accuracy } = req.body || {};
  if(typeof lat !== 'number' || typeof lng !== 'number'){
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  const db = load();
  const patient = db.patients.find(p => p.id === req.patient.id);
  if(!patient.sharingEnabled){
    return res.status(403).json({ error: 'Location sharing is currently turned off for this person' });
  }

  const point = { lat, lng, accuracy: accuracy || null, timestamp: new Date().toISOString() };
  const bucket = db.locations[patient.id] || { current: null, history: [] };
  bucket.current = point;
  bucket.history.push(point);
  if(bucket.history.length > MAX_HISTORY_POINTS) bucket.history = bucket.history.slice(-MAX_HISTORY_POINTS);
  db.locations[patient.id] = bucket;
  save(db);

  // Push it live to any caregiver dashboards currently watching this patient's room.
  req.app.locals.io.to('patient:' + patient.id).emit('location-update', point);

  res.json({ ok: true, point });
});

// A linked caregiver reads the latest known point.
router.get('/current', requireCaregiverAuth, (req, res) => {
  const db = load();
  const patient = db.patients.find(p => p.id === req.caregiver.patientId);
  if(!patient) return res.status(404).json({ error: 'Linked patient not found' });
  if(!patient.sharingEnabled) return res.status(403).json({ error: 'This person has turned off location sharing' });

  const bucket = db.locations[patient.id] || { current: null, history: [] };
  res.json({ patientName: patient.name, current: bucket.current });
});

// A linked caregiver reads recent history, e.g. to draw a short trail on the map.
router.get('/history', requireCaregiverAuth, (req, res) => {
  const db = load();
  const patient = db.patients.find(p => p.id === req.caregiver.patientId);
  if(!patient) return res.status(404).json({ error: 'Linked patient not found' });
  if(!patient.sharingEnabled) return res.status(403).json({ error: 'This person has turned off location sharing' });

  const bucket = db.locations[patient.id] || { current: null, history: [] };
  res.json({ history: bucket.history.slice(-50) });
});

module.exports = router;