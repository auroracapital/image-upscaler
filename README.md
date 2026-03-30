# Image Upscaler

Upload images with resumable parallel-chunk transfers and upscale them using AI via [WaveSpeed.ai](https://wavespeed.ai).

## Features

- **Resumable uploads** — [tus protocol](https://tus.io) with auto-resume across sessions
- **Parallel chunks** — files split into 5 parts uploaded simultaneously for max bandwidth
- **Progress tracking** — real-time upload progress with retry on failure
- **AI upscaling** — WaveSpeed Real-ESRGAN (2x / 4x) at $0.0024 per image
- **Side-by-side preview** — compare original and upscaled before downloading

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Tailwind CSS v4, Uppy Dashboard |
| Upload | tus protocol via `@uppy/tus` + `@tus/server` |
| Backend | Express, Node.js HTTP server |
| AI | WaveSpeed.ai REST API (Real-ESRGAN) |
| Deploy | Render (render.yaml included) |

## Quick Start

```bash
git clone https://github.com/auroracapital/image-upscaler.git
cd image-upscaler
npm install
cp .env.example .env   # add your WaveSpeed API key
npm run dev             # client on :5173, server on :3001
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WAVESPEED_API_KEY` | Yes | — | Your [WaveSpeed API key](https://wavespeed.ai) |
| `WAVESPEED_UPSCALE_MODEL` | No | `wavespeed-ai/real-esrgan` | Model path ([browse models](https://wavespeed.ai/models)) |
| `PORT` | No | `3001` | Server port |

## Deploy to Render

1. Fork or push this repo
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your repo — Render auto-detects `render.yaml`
4. Set `WAVESPEED_API_KEY` in environment variables
5. Deploy

## How It Works

```
Browser                    Server                     WaveSpeed
  │                          │                           │
  ├─ tus PATCH (5 chunks) ──►│                           │
  │  parallel, resumable     │                           │
  │◄── upload complete ──────│                           │
  │                          │                           │
  ├─ POST /api/upscale ─────►├─ POST /media/upload ─────►│
  │                          │◄── download_url ──────────│
  │                          ├─ POST /real-esrgan ───────►│
  │◄── { taskId } ──────────│◄── { id, status } ────────│
  │                          │                           │
  ├─ GET /api/upscale/:id ──►├─ GET /predictions/:id ───►│
  │◄── { status, outputs } ──│◄── result ───────────────│
```

## License

MIT
