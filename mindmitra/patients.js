const express = require('express');
const { v4: uuid } = require('uuid');
const { load, save } = require('../db');
const { requirePatientAuth } = require('../middleware/auth');

const router = express.Router();

function newPairingCode(){
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Called once, the first time the MindMitra app runs on a person's device.
// Creates the patient's record and issues the token their app will use for every
// future request, plus a pairing code they can hand to a caregiver.
router.post('/register', (req, res) => {
  const { name } = req.body || {};
  if(!name) return res.status(400).json({ error: 'name is required' });

  const db = load();
  const patient = {
    id: uuid(),
    name,
    token: uuid(),
    pairingCode: newPairingCode(),
    sharingEnabled: false,
    createdAt: new Date().toISOString(),
  };
  db.patients.push(patient);
  db.locations[patient.id] = { current: null, history: [] };
  save(db);

  res.json({ patientId: patient.id, token: patient.token, pairingCode: patient.pairingCode });
});

// The patient app calls this to see its own profile, sharing status, and who is
// currently authorized to see its location.
router.get('/me', requirePatientAuth, (req, res) => {
  const db = load();
  const caregivers = db.caregivers
    .filter(c => c.patientId === req.patient.id)
    .map(c => ({ id: c.id, name: c.name, phone: c.phone, relation: c.relation }));

  res.json({
    id: req.patient.id,
    name: req.patient.name,
    pairingCode: req.patient.pairingCode,
    sharingEnabled: req.patient.sharingEnabled,
    caregivers,
  });
});

// The consent switch. Only the patient's own token can flip this — a caregiver
// can never turn tracking on for someone else.
router.post('/sharing', requirePatientAuth, (req, res) => {
  const { enabled } = req.body || {};
  const db = load();
  const patient = db.patients.find(p => p.id === req.patient.id);
  patient.sharingEnabled = !!enabled;
  save(db);

  req.app.locals.io.to('patient:' + patient.id).emit('sharing-changed', { enabled: patient.sharingEnabled });
  res.json({ sharingEnabled: patient.sharingEnabled });
});

// Invalidates the old pairing code (e.g. if it was shared with the wrong person)
// without affecting caregivers who are already linked.
router.post('/pairing-code/rotate', requirePatientAuth, (req, res) => {
  const db = load();
  const patient = db.patients.find(p => p.id === req.patient.id);
  patient.pairingCode = newPairingCode();
  save(db);
  res.json({ pairingCode: patient.pairingCode });
});

module.exports = router;