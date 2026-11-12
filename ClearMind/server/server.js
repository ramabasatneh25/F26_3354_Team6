// ClearMind - server tier entry point.
// Client-Server architecture (SDD section 2.5.3): this process is the server.
// It exposes a JSON REST API over HTTPS-terminated HTTP and, in production,
// also serves the built React client so the whole app runs on one port.

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const checkinRoutes = require('./routes/checkins');
const reportRoutes = require('./routes/reports');
const resourceRoutes = require('./routes/resources');
const connectionRoutes = require('./routes/connections');
const accountRoutes = require('./routes/account');
const { PROVIDER } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '2mb' })); // 2mb covers a CSV bulk import

// Interoperability NFR: a simple health endpoint for the host to poll.
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', authProvider: PROVIDER, time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/account', accountRoutes);

// Serve the built client when it exists (npm run build in client/).
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Any non-API route falls through to the SPA so client-side routing works.
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'No such endpoint.' }));

// Reliability NFR: an unhandled error returns a message rather than crashing,
// so the client can tell the student their entry was kept for resubmission.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[clearmind]', err);
  res.status(500).json({ error: 'Something went wrong on our end. Your entry was not lost.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ClearMind API listening on http://localhost:${PORT}`);
    console.log(`Auth provider: ${PROVIDER}`);
    if (fs.existsSync(clientDist)) console.log('Serving built client from client/dist');
  });
}

module.exports = app;
