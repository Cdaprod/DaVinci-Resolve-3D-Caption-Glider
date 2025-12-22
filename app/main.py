"""FastAPI caption pipeline service for LAN projects.

Example (dev): uvicorn app.main:app --reload --host 0.0.0.0 --port 8791
Docker: docker compose up --build captioner
"""
from __future__ import annotations

import hashlib
import json
import logging
import mimetypes
import os
import subprocess
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import httpx
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND
from faster_whisper import WhisperModel

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"
DEFAULT_PROJECTS_ROOT = Path(os.environ.get("CAPTIONER_PROJECTS_ROOT", "/data/projects")).resolve()
CAPTIONER_HOST = os.environ.get("CAPTIONER_HOST", "0.0.0.0")
CAPTIONER_PORT = int(os.environ.get("CAPTIONER_PORT", "8791"))
CAPTIONER_MAX_UPLOAD_MB = int(os.environ.get("CAPTIONER_MAX_UPLOAD_MB", "4096"))
MEDIA_SYNC_BASE_URL = os.environ.get("MEDIA_SYNC_BASE_URL", "").strip()
CORS_ORIGINS = [o.strip() for o in os.environ.get("CAPTIONER_CORS_ORIGINS", "*").split(",") if o.strip()]

ALLOWED_SERVE_ROOTS = {"captions", "ingest", "exports", "resolve", "teleprompter", "_manifest"}
SUPPORTED_VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".m4v", ".avi"}

logger = logging.getLogger("captioner")
logging.basicConfig(level=logging.INFO)


class CaptionRequest(BaseModel):
    """Request payload for generating caption artifacts."""

    video_rel_path: str = Field(..., description="Path to the source video relative to the project root")
    model_size: str = Field("small", description="faster-whisper model size identifier")
    max_chars: int = Field(72, description="Maximum characters per caption line")


class CaptionPaths(BaseModel):
    sha256: str
    video_rel_path: str
    words_rel_path: str
    lines_rel_path: str
    srt_rel_path: str


class TranscriptionResult(BaseModel):
    sha256: str
    words: List[Dict[str, object]]


_model_cache: Dict[str, WhisperModel] = {}


def ensure_relative_path(rel_path: str) -> Path:
    """Return a safe relative Path, rejecting absolute or traversal attempts."""

    if rel_path is None or str(rel_path).strip() == "":
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Path is required")

    try:
        candidate = Path(rel_path)
    except TypeError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if candidate.is_absolute():
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Absolute paths are not allowed")

    if any(part in {"..", ""} for part in candidate.parts):
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Path traversal is not allowed")

    return candidate


def resolve_project_root(project: str, projects_root: Path = DEFAULT_PROJECTS_ROOT) -> Path:
    """Resolve and validate an existing project directory."""

    project_name = project.strip("/\\")
    safe_name = ensure_relative_path(project_name)
    root = (projects_root / safe_name).resolve()
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Project not found")
    if projects_root not in root.parents and projects_root != root:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Project path outside root")
    return root


def ensure_allowed_relative(rel_path: str) -> Path:
    """Ensure the relative path is within an allowlisted top-level directory."""

    candidate = ensure_relative_path(rel_path)
    if not candidate.parts:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Empty path not allowed")

    if candidate.parts[0] not in ALLOWED_SERVE_ROOTS:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Directory not allowed")
    return candidate


def compute_sha256(path: Path) -> str:
    """Stream the file to compute a SHA-256 hash."""

    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def extract_audio(video_path: Path, audio_path: Path) -> None:
    """Extract mono 16k audio using ffmpeg."""

    audio_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(audio_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=f"ffmpeg failed: {result.stderr.strip()}")


def load_model(model_size: str) -> WhisperModel:
    """Load or reuse a faster-whisper model."""

    if model_size in _model_cache:
        return _model_cache[model_size]

    model = WhisperModel(model_size)
    _model_cache[model_size] = model
    return model


def transcribe_audio(audio_path: Path, model_size: str) -> List[Dict[str, object]]:
    """Run faster-whisper transcription with word timestamps enabled."""

    model = load_model(model_size)
    segments, _ = model.transcribe(str(audio_path), vad_filter=True, word_timestamps=True)
    words: List[Dict[str, object]] = []
    for segment in segments:
        for word in segment.words:
            words.append(
                {
                    "start": float(word.start or 0),
                    "end": float(word.end or 0),
                    "text": str(word.word or "").strip(),
                }
            )
    return words


def build_lines(words: List[Dict[str, object]], max_chars: int) -> List[Dict[str, object]]:
    """Group words into caption lines respecting max_chars."""

    lines: List[Dict[str, object]] = []
    current: List[Dict[str, object]] = []
    for word in words:
        text = str(word.get("text", "")).strip()
        if not text:
            continue
        tentative = " ".join([w.get("text", "") for w in current] + [text]).strip()
        if current and len(tentative) > max_chars:
            lines.append({
                "text": " ".join([w.get("text", "") for w in current]).strip(),
                "start": float(current[0].get("start", 0.0)),
                "end": float(current[-1].get("end", current[0].get("start", 0.0))),
            })
            current = []
        current.append({"text": text, "start": word.get("start", 0.0), "end": word.get("end", 0.0)})

    if current:
        lines.append({
            "text": " ".join([w.get("text", "") for w in current]).strip(),
            "start": float(current[0].get("start", 0.0)),
            "end": float(current[-1].get("end", current[0].get("start", 0.0))),
        })

    return lines


def write_lines_txt(lines: Iterable[Dict[str, object]], path: Path) -> None:
    """Write plain text lines to disk."""

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for line in lines:
            f.write(str(line.get("text", "")).strip() + "\n")


def format_timestamp(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    hrs, rem = divmod(total_ms, 3600 * 1000)
    mins, rem = divmod(rem, 60 * 1000)
    secs, ms = divmod(rem, 1000)
    return f"{hrs:02}:{mins:02}:{secs:02},{ms:03}"


def write_srt(lines: Iterable[Dict[str, object]], path: Path) -> None:
    """Write SRT captions from timed lines."""

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for idx, line in enumerate(lines, start=1):
            start = format_timestamp(float(line.get("start", 0)))
            end = format_timestamp(float(line.get("end", 0)))
            text = str(line.get("text", "")).strip()
            f.write(f"{idx}\n{start} --> {end}\n{text}\n\n")


def write_words_json(meta: Dict[str, object], words: List[Dict[str, object]], path: Path) -> None:
    """Persist the canonical words json artifact."""

    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"meta": meta, "words": words}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def resolve_caption_paths(video_rel_path: str, sha: str) -> CaptionPaths:
    sha10 = sha[:10]
    safe_rel = ensure_relative_path(video_rel_path)
    base_name = f"{safe_rel.stem}__{sha10}"
    return CaptionPaths(
        sha256=sha,
        video_rel_path=str(safe_rel).replace(os.sep, "/"),
        words_rel_path=str(Path("captions") / f"{base_name}.words.json"),
        lines_rel_path=str(Path("captions") / f"{base_name}.lines.txt"),
        srt_rel_path=str(Path("captions") / f"{base_name}.srt"),
    )


def list_projects(projects_root: Path = DEFAULT_PROJECTS_ROOT) -> List[str]:
    if not projects_root.exists():
        return []
    return [p.name for p in projects_root.iterdir() if p.is_dir() and not p.name.startswith(".")]


def list_project_videos(project_root: Path) -> List[str]:
    ingest_dir = project_root / "ingest"
    results: List[str] = []
    for sub in [ingest_dir] + [p for p in ingest_dir.glob("*") if p.is_dir()]:
        for file_path in sub.rglob("*"):
            if file_path.suffix.lower() in SUPPORTED_VIDEO_SUFFIXES and file_path.is_file():
                rel = file_path.relative_to(project_root)
                results.append(str(rel).replace(os.sep, "/"))
    return sorted(results)


def find_caption_artifacts(project_root: Path, video_rel_path: str, sha: str) -> Optional[CaptionPaths]:
    video_path = ensure_relative_path(video_rel_path)
    stem = video_path.stem
    sha10 = sha[:10]
    base_name = f"{stem}__{sha10}"
    captions_dir = project_root / "captions"
    words = captions_dir / f"{base_name}.words.json"
    lines = captions_dir / f"{base_name}.lines.txt"
    srt = captions_dir / f"{base_name}.srt"
    if words.exists() and lines.exists() and srt.exists():
        return CaptionPaths(
            sha256=sha,
            video_rel_path=str(video_rel_path),
            words_rel_path=str(words.relative_to(project_root)),
            lines_rel_path=str(lines.relative_to(project_root)),
            srt_rel_path=str(srt.relative_to(project_root)),
        )
    return None


def best_effort_media_sync(project: str, payload: Dict[str, object]) -> None:
    if not MEDIA_SYNC_BASE_URL:
        return
    url = f"{MEDIA_SYNC_BASE_URL.rstrip('/')}/api/projects/{project}/resolve/jobs/import-captions"
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.post(url, json=payload)
            if resp.status_code >= 400:
                logger.warning("Media-sync handoff failed: %s", resp.text)
    except Exception as exc:  # pragma: no cover - network errors handled silently
        logger.warning("Media-sync handoff error: %s", exc)


def create_app() -> FastAPI:
    app = FastAPI(title="Captioner", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/public", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")

    @app.get("/health")
    async def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/projects")
    async def get_projects() -> Dict[str, List[str]]:
        return {"projects": list_projects()}

    @app.get("/api/projects/{project}/media")
    async def get_project_media(project: str) -> Dict[str, List[str]]:
        project_root = resolve_project_root(project)
        return {"videos": list_project_videos(project_root)}

    @app.get("/api/projects/{project}/file")
    async def get_project_file(project: str, path: str = Query(..., description="Relative path to file")) -> Response:
        project_root = resolve_project_root(project)
        relative = ensure_allowed_relative(path)
        target = (project_root / relative).resolve()
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="File not found")
        if project_root not in target.parents and project_root != target:
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Invalid file location")
        media_type, _ = mimetypes.guess_type(target.name)
        return FileResponse(target, media_type=media_type)

    @app.get("/api/projects/{project}/media/captions")
    async def get_captions_for_video(project: str, video_rel_path: str = Query(...)) -> CaptionPaths:
        project_root = resolve_project_root(project)
        safe_rel = ensure_relative_path(video_rel_path)
        video_path = (project_root / safe_rel).resolve()
        if not video_path.exists():
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Video not found")
        sha = compute_sha256(video_path)
        found = find_caption_artifacts(project_root, str(safe_rel).replace(os.sep, "/"), sha)
        if not found:
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Captions not found")
        return found

    @app.post("/api/projects/{project}/media/generate-captions")
    async def generate_captions(project: str, payload: CaptionRequest = Body(...)) -> CaptionPaths:
        project_root = resolve_project_root(project)
        video_rel = ensure_relative_path(payload.video_rel_path)
        video_path = (project_root / video_rel).resolve()
        if not video_path.exists() or not video_path.is_file():
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Video not found")
        if project_root not in video_path.parents:
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Video path outside project")

        sha = compute_sha256(video_path)
        stem = video_path.stem
        manifest_tmp = project_root / "_manifest" / "tmp"
        audio_path = manifest_tmp / f"{stem}__{sha[:10]}.wav"
        extract_audio(video_path, audio_path)

        words = transcribe_audio(audio_path, payload.model_size)
        if not words:
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="No words produced")

        lines = build_lines(words, payload.max_chars)
        artifacts = resolve_caption_paths(str(video_rel), sha)

        write_words_json({"sha256": sha, "video_rel_path": str(video_rel)}, words, project_root / artifacts.words_rel_path)
        write_lines_txt(lines, project_root / artifacts.lines_rel_path)
        write_srt(lines, project_root / artifacts.srt_rel_path)

        best_effort_media_sync(
            project,
            {
                "sha256": sha,
                "srt_rel_path": artifacts.srt_rel_path,
                "timeline": None,
                "subtitle_track": None,
            },
        )

        return artifacts

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=CAPTIONER_HOST, port=CAPTIONER_PORT)
