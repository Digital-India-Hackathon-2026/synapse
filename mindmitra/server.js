require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const patientsRouter = require('./src/routes/patients');
const caregiversRouter = require('./src/routes/caregivers');
const locationRouter = require('./src/routes/location');
const { attachSocket } = require('./src/socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Makes `io` reachable from inside route handlers via req.app.locals.io
app.locals.io = io;

app.get('/health', (req, res) => res.json({ ok: true, service: 'MindMitra location backend' }));

app.use('/api/patients', patientsRouter);
app.use('/api/caregivers', caregiversRouter);
app.use('/api/location', locationRouter);

attachSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`MindMitra location backend running on http://localhost:${PORT}`);
});