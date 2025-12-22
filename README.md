# DaVinci Resolve 3D Caption Glider

A beautiful 3D animated caption system for DaVinci Resolve that now ships as a standalone FastAPI service. It serves the glider UI, extracts audio with ffmpeg, transcribes locally with faster-whisper, and writes caption artifacts next to your project media.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-green.svg)
![DaVinci Resolve](https://img.shields.io/badge/DaVinci%20Resolve-18%2B-red.svg)

## ✨ Features

- 🎬 Auto-sync with DaVinci Resolve transcripts or LAN-hosted caption files
- 🛰️ Offline pipeline: ffmpeg audio extraction + faster-whisper transcription (no cloud calls)
- 🎨 3D animated text with typography profiles from `docs/TYPOGRAPHY.md`
- 📂 Shared workspace mount (`/data/projects`) for caption artifacts used by Resolve, media-sync, and teleprompter
- 🌐 Static UI available at `/public/caption-glider/` from any device on the LAN

## 🚀 Quick Start

1. Install dependencies: `pip install -r requirements.txt`
2. Run with hot reload: `CAPTIONER_PROJECTS_ROOT=/data/projects uvicorn app.main:app --reload --host 0.0.0.0 --port 8791`
3. Or start Docker (bind your Projects workspace to `/data/projects`): `docker compose up --build captioner`
4. Open the UI at `http://localhost:8791/public/caption-glider/`
5. Pick a project and video from `/data/projects/<Project>/ingest` and click **Generate Captions** to emit `<Project>/captions/<stem>__<sha10>.{lines.txt,srt,words.json}`

## 🎮 Usage

The LAN pipeline reads media inside `/data/projects/<Project>/ingest` (Windows mount example: `B:/Video/Projects` → `/data/projects`) and writes caption artifacts to `<Project>/captions`. The glider UI fetches caption text via `cfg.linesUrl`, which points to `/api/projects/{project}/file?path=<rel>`.

Key endpoints on port `8791`:
- `GET /health` — service heartbeat
- `GET /api/projects` — list projects under `CAPTIONER_PROJECTS_ROOT`
- `GET /api/projects/{project}/media` — list videos under `ingest/`
- `POST /api/projects/{project}/media/generate-captions` — extract audio with ffmpeg, transcribe via faster-whisper (word timestamps on), and emit `.lines.txt`, `.srt`, `.words.json`
- `GET /api/projects/{project}/media/captions?video_rel_path=...` — resolve the latest caption trio for a source video
- `GET /api/projects/{project}/file?path=...` — safe file serving for allowlisted folders (`captions/`, `ingest/`, `exports/`, `resolve/`, `teleprompter/`, `_manifest/`)

Optional: set `MEDIA_SYNC_BASE_URL` to post the generated `.srt` to media-sync’s Resolve import endpoint; failures are logged without breaking caption generation.

## 🧪 Testing

- Python API and path safety: `python -m pytest`
- JS helper coverage: `node tests/animation-helpers.test.js` and `node tests/lighting-rig.test.js`

## ⚙️ Configuration

Edit the `cfg` object in `public/index.html` (or use the built-in configuration drawer) to tune fonts, spacing, reveal style, alignment, emphasis profiles, and typography presets sourced from `docs/TYPOGRAPHY.md`. New UI selections persist to `captioner_state_v1` in localStorage and the seeded `public/localStorage.json` files.
