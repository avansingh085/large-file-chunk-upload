const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./src/config/db');
const uploadRoutes = require('./src/routes/uploadRoutes');
const {cleanupOrphanedUploads}=require('./src/controllers/uploadController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Ensure Uploads Directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Routes
app.use('/api', uploadRoutes);
app.get('/hellow', (req, res) => res.send("hellow server"));

// RUN CLEANUP EVERY 12 HOURS
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
setInterval(() => {
    console.log("Starting scheduled cleanup of orphaned files...");
    cleanupOrphanedUploads();
}, TWELVE_HOURS);

// Start Server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
  });
});