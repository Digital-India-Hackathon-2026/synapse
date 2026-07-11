/*
 * Minimal file-backed data store.
 *
 * This is intentionally simple (plain JSON on disk) so the whole project can be
 * cloned and run in a minute with no external database. Swap this module out for
 * a real database (Postgres/Mongo) before using this with real patient data —
 * see the "Going to production" section in README.md.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function ensureFile(){
  if(!fs.existsSync(DB_PATH)){
    const initial = { patients: [], caregivers: [], locations: {} };
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function load(){
  ensureFile();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function save(data){
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { load, save };