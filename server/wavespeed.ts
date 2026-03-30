import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://api.wavespeed.ai/api/v3';

function apiKey(): string {
  const k = process.env.WAVESPEED_API_KEY;
  if (!k) throw new Error('WAVESPEED_API_KEY not set');
  return k;
}

function model(): string {
  return process.env.WAVESPEED_UPSCALE_MODEL || 'wavespeed-ai/real-esrgan';
}

async function uploadFile(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), name);

  const res = await fetch(`${API_BASE}/media/upload/binary`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`WaveSpeed upload failed: ${res.status}`);
  const json = await res.json();
  return json.data.download_url;
}

async function startUpscale(imageUrl: string, scale: number) {
  const res = await fetch(`${API_BASE}/${model()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: imageUrl, scale }),
  });

  if (!res.ok) throw new Error(`WaveSpeed upscale failed: ${res.status}`);
  return res.json();
}

async function taskStatus(taskId: string) {
  const res = await fetch(`${API_BASE}/predictions/${taskId}/result`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`WaveSpeed status failed: ${res.status}`);
  return res.json();
}

export function createUpscaleRouter(uploadsDir: string): Router {
  const router = Router();

  router.post('/upscale', async (req: Request, res: Response) => {
    try {
      const { fileId, scale = 4 } = req.body;
      if (!fileId) { res.status(400).json({ error: 'fileId required' }); return; }

      const filePath = path.join(uploadsDir, fileId);
      if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

      const imageUrl = await uploadFile(filePath);
      const result = await startUpscale(imageUrl, scale);
      const taskId = result.data?.id;

      if (!taskId) { res.status(502).json({ error: 'No task ID from WaveSpeed', details: result }); return; }

      // Clean up local file after forwarding to WaveSpeed
      fs.unlink(filePath, () => {});
      fs.unlink(`${filePath}.json`, () => {}); // tus metadata

      res.json({ taskId, originalUrl: imageUrl });
    } catch (err: any) {
      console.error('POST /api/upscale', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/upscale/:taskId', async (req: Request, res: Response) => {
    try {
      const result = await taskStatus(req.params.taskId);
      res.json(result);
    } catch (err: any) {
      console.error('GET /api/upscale/:taskId', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
