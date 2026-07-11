/*
 * Very small bearer-token check. Tokens are opaque UUIDs issued at registration
 * (see routes/patients.js and routes/caregivers.js). This is enough to demo the
 * consent flow end to end, but it is NOT production-grade auth — there's no
 * password, no expiry, and no rate limiting. Harden this before handling real
 * patient data (see README "Going to production").
 */
const { load } = require('../db');

function getToken(req){
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function requirePatientAuth(req, res, next){
  const token = getToken(req);
  const db = load();
  const patient = db.patients.find(p => p.token === token);
  if(!patient) return res.status(401).json({ error: 'Invalid or missing patient token' });
  req.patient = patient;
  next();
}

function requireCaregiverAuth(req, res, next){
  const token = getToken(req);
  const db = load();
  const caregiver = db.caregivers.find(c => c.token === token);
  if(!caregiver) return res.status(401).json({ error: 'Invalid or missing caregiver token' });
  req.caregiver = caregiver;
  next();
}

module.exports = { requirePatientAuth, requireCaregiverAuth };