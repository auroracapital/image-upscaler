import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { createUpscaleRouter } from './wavespeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const UPLOADS_DIR = path.resolve('./uploads');

// Express app for API + static files
const app = express();
app.use(express.json());
app.use('/api', createUpscaleRouter(UPLOADS_DIR));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// TUS server — resumable uploads with parallel concatenation
const tusServer = new TusServer({
  path: '/api/tus',
  datastore: new FileStore({ directory: UPLOADS_DIR }),
  respectForwardedHeaders: true,
  maxSize: 100 * 1024 * 1024,
});

// Route tus traffic before Express to avoid body-parser interference
const httpServer = http.createServer((req, res) => {
  if (req.url?.startsWith('/api/tus')) {
    tusServer.handle(req, res);
    return;
  }
  app(req, res);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
