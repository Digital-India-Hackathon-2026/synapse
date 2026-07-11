const express = require('express');
const { v4: uuid } = require('uuid');
const { load, save } = require('../db');
const { requirePatientAuth, requireCaregiverAuth } = require('../middleware/auth');

const router = express.Router();

// A caregiver "registers themselves in the person's file" by entering the pairing
// code the patient showed them in Settings. This is the consent step — nobody can
// be added as a caregiver without a code the patient chose to share.
router.post('/link', (req, res) => {
  const { name, phone, relation, pairingCode } = req.body || {};
  if(!name || !pairingCode) return res.status(400).json({ error: 'name and pairingCode are required' });

  const db = load();
  const patient = db.patients.find(p => p.pairingCode === pairingCode);
  if(!patient) return res.status(404).json({ error: 'Invalid pairing code' });

  const caregiver = {
    id: uuid(),
    name,
    phone: phone || '',
    relation: relation || 'Caregiver',
    patientId: patient.id,
    token: uuid(),
    createdAt: new Date().toISOString(),
  };
  db.caregivers.push(caregiver);
  save(db);

  res.json({
    caregiverId: caregiver.id,
    token: caregiver.token,
    patient: { id: patient.id, name: patient.name },
  });
});

// The patient revokes a caregiver's access at any time — this is the "off switch"
// for one specific person rather than everyone.
router.delete('/:caregiverId', requirePatientAuth, (req, res) => {
  const db = load();
  const before = db.caregivers.length;
  db.caregivers = db.caregivers.filter(
    c => !(c.id === req.params.caregiverId && c.patientId === req.patient.id)
  );
  save(db);
  res.json({ removed: before !== db.caregivers.length });
});

// A caregiver checks who they're linked to and whether that person currently has
// sharing turned on.
router.get('/me', requireCaregiverAuth, (req, res) => {
  const db = load();
  const patient = db.patients.find(p => p.id === req.caregiver.patientId);
  res.json({
    id: req.caregiver.id,
    name: req.caregiver.name,
    patient: patient ? { id: patient.id, name: patient.name, sharingEnabled: patient.sharingEnabled } : null,
  });
});

module.exports = router;