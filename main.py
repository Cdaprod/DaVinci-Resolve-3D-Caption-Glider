#!/usr/bin/env python3
"""FastAPI bridge for DaVinci Resolve captions.

Example (hot reload):
    uvicorn main:app --reload --host 0.0.0.0 --port 8080
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    import DaVinciResolveScript as dvr_script
except ImportError:  # pragma: no cover - handled at runtime when Resolve is unavailable
    dvr_script = None

resolve = None
project = None
timeline = None
PUBLIC_DIR = Path("public")
CAPTIONS_DIR = Path("captions")
CAPTIONS_DIR.mkdir(parents=True, exist_ok=True)
IMPORT_QUEUE: List[dict] = []


class WordPayload(BaseModel):
    """Timed word payload from Resolve or manual input."""

    text: str
    startTime: float
    endTime: float
    startFrame: Optional[int] = None
    endFrame: Optional[int] = None


class LinePayload(BaseModel):
    """Line payload combining text and timing."""

    text: str
    startTime: float
    endTime: float
    words: Optional[List[WordPayload]] = None


class ExportTranscriptLinesRequest(BaseModel):
    """Request body for grouping words into readable lines."""

    words: List[WordPayload] = Field(default_factory=list)
    wordsPerLine: int = 8


class CreateAnimatedCaptionsRequest(BaseModel):
    """Request body for creating timeline subtitles."""

    words: List[WordPayload] = Field(default_factory=list)
    wordsPerLine: int = 8


class ExportSrtRequest(BaseModel):
    """Request body for exporting SRT and triggering Resolve import."""

    lines: Optional[List[LinePayload]] = None
    words: Optional[List[WordPayload]] = None
    wordsPerLine: int = 8
    fileName: str = "captions"
    enqueueImport: bool = True


app = FastAPI(title="Caption Glider", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/public", StaticFiles(directory=PUBLIC_DIR, html=True), name="static")


@app.get("/", include_in_schema=False)
def serve_index():
    """Serve the SPA entrypoint."""

    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_static(full_path: str):
    """Serve static assets while keeping API routes intact."""

    target = PUBLIC_DIR / full_path
    if target.exists() and target.is_file():
        return FileResponse(target)

    return FileResponse(PUBLIC_DIR / "index.html")


def init_resolve() -> tuple[bool, str]:
    """Initialize Resolve connections if available."""

    global resolve, project, timeline

    if resolve and project and timeline:
        return True, "Connected successfully"

    if dvr_script is None:
        return False, "DaVinci Resolve scripting module not found"

    try:
        resolve = dvr_script.scriptapp("Resolve")
        if not resolve:
            return False, "Could not connect to DaVinci Resolve"

        project_manager = resolve.GetProjectManager()
        project = project_manager.GetCurrentProject()
        if not project:
            return False, "No project open in Resolve"

        timeline = project.GetCurrentTimeline()
        if not timeline:
            return False, "No timeline open in Resolve"

        return True, "Connected successfully"
    except Exception as exc:  # pragma: no cover - runtime integration
        return False, str(exc)


def get_clip_transcription(clip) -> Optional[dict]:
    """Extract transcription from clip or subtitle tracks."""

    try:
        frame_rate = float(timeline.GetSetting("timelineFrameRate"))
        clip_start_frame = clip.GetStart()
        clip_end_frame = clip.GetEnd()
        clip_duration = clip.GetDuration()
        subtitle_count = timeline.GetTrackCount("subtitle")

        words: List[dict] = []

        if subtitle_count > 0:
            for track_idx in range(1, subtitle_count + 1):
                subtitles = timeline.GetItemListInTrack("subtitle", track_idx)

                if subtitles:
                    for sub in subtitles:
                        sub_start = sub.GetStart()
                        sub_end = sub.GetEnd()
                        sub_text = sub.GetName()

                        if sub_start >= clip_start_frame and sub_end <= clip_end_frame:
                            words.append(
                                {
                                    "text": sub_text,
                                    "startTime": (sub_start - clip_start_frame) / frame_rate,
                                    "endTime": (sub_end - clip_start_frame) / frame_rate,
                                    "startFrame": sub_start - clip_start_frame,
                                    "endFrame": sub_end - clip_start_frame,
                                }
                            )

        if not words:
            clip_props = clip.GetProperty()
            if clip_props and "Transcription" in clip_props:
                trans_data = clip_props["Transcription"]
                words = parse_transcription_metadata(trans_data, frame_rate)

        return {
            "clipName": clip.GetName(),
            "clipStart": clip_start_frame / frame_rate,
            "clipDuration": clip_duration / frame_rate,
            "frameRate": frame_rate,
            "words": words,
            "fullText": " ".join([w["text"] for w in words]),
        }
    except Exception as exc:  # pragma: no cover - runtime integration
        print(f"Transcription extraction error: {exc}")
        return None


def parse_transcription_metadata(trans_data, frame_rate: float) -> List[dict]:
    """Parse transcription from clip metadata if stored there."""

    words: List[dict] = []
    try:
        if isinstance(trans_data, str):
            trans_json = json.loads(trans_data)
            for item in trans_json.get("words", []):
                words.append(
                    {
                        "text": item["word"],
                        "startTime": item["start"],
                        "endTime": item["end"],
                        "startFrame": int(item["start"] * frame_rate),
                        "endFrame": int(item["end"] * frame_rate),
                    }
                )
    except Exception:
        pass

    return words


def build_lines_from_words(words: List[WordPayload], words_per_line: int) -> List[LinePayload]:
    """Group words into line payloads to drive exports."""

    lines: List[LinePayload] = []
    current_line: List[WordPayload] = []

    for word in words:
        if not current_line:
            current_line.append(word)
        else:
            current_line.append(word)

        if len(current_line) >= words_per_line:
            lines.append(
                LinePayload(
                    text=" ".join([w.text for w in current_line]),
                    startTime=current_line[0].startTime,
                    endTime=current_line[-1].endTime,
                    words=list(current_line),
                )
            )
            current_line = []

    if current_line:
        lines.append(
            LinePayload(
                text=" ".join([w.text for w in current_line]),
                startTime=current_line[0].startTime,
                endTime=current_line[-1].endTime,
                words=list(current_line),
            )
        )

    return lines


def format_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp (HH:MM:SS,mmm)."""

    total_ms = int(round(seconds * 1000))
    hours, remainder = divmod(total_ms, 3600 * 1000)
    minutes, remainder = divmod(remainder, 60 * 1000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def write_srt_file(lines: List[LinePayload], file_name: str) -> Path:
    """Write SRT file to captions directory and return its path."""

    sanitized_name = file_name.strip() or "captions"
    target = CAPTIONS_DIR / f"{sanitized_name}.srt"

    srt_lines: List[str] = []
    for idx, line in enumerate(sorted(lines, key=lambda l: l.startTime), start=1):
        srt_lines.append(str(idx))
        srt_lines.append(
            f"{format_timestamp(line.startTime)} --> {format_timestamp(line.endTime)}"
        )
        srt_lines.append(line.text)
        srt_lines.append("")

    target.write_text("\n".join(srt_lines), encoding="utf-8")
    return target


def enqueue_import_job(file_path: Path) -> dict:
    """Queue an import job and attempt it immediately when Resolve is reachable."""

    job = {"filePath": str(file_path), "status": "queued"}
    IMPORT_QUEUE.append(job)

    success, message = init_resolve()
    if not success:
        job.update({"status": "blocked", "message": message})
        return job

    if not hasattr(timeline, "ImportSubtitles"):
        job.update({"status": "unsupported", "message": "ImportSubtitles unavailable"})
        return job

    try:
        imported = timeline.ImportSubtitles(str(file_path))
        job.update({"status": "completed" if imported else "failed", "message": message})
    except Exception as exc:  # pragma: no cover - runtime integration
        job.update({"status": "failed", "message": str(exc)})

    return job


@app.get("/api/get-transcription")
def get_transcription():
    """Fetch transcription from the selected clip.

    Example:
        curl http://localhost:8080/api/get-transcription
    """

    success, msg = init_resolve()
    if not success:
        raise HTTPException(status_code=500, detail=msg)

    selected_clips = timeline.GetItemListInTrack("video", 1) or timeline.GetItemListInTrack(
        "audio", 1
    )
    if not selected_clips:
        raise HTTPException(status_code=400, detail="No clips found. Select a clip with audio.")

    clip = selected_clips[0]
    transcription_data = get_clip_transcription(clip)

    if not transcription_data:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "No transcription found. Please transcribe audio first in Resolve.",
                "instructions": "Right-click clip → Transcribe Audio → Select language → OK",
            },
        )

    return transcription_data


@app.post("/api/transcribe-clip")
def transcribe_clip():
    """Provide manual steps for Resolve transcription (API placeholder).

    Example:
        curl -X POST http://localhost:8080/api/transcribe-clip
    """

    success, msg = init_resolve()
    if not success:
        raise HTTPException(status_code=500, detail=msg)

    return {
        "message": "Please transcribe audio manually in Resolve:",
        "steps": [
            "1. Select the audio/video clip",
            "2. Right-click → Transcribe Audio",
            "3. Choose language and click OK",
            "4. Wait for transcription to complete",
            "5. Click 'Get Transcription' again",
        ],
    }


@app.post("/api/export-transcript-lines")
def export_transcript_lines(payload: ExportTranscriptLinesRequest):
    """Convert transcription into grouped lines for the captioner.

    Example:
        curl -X POST http://localhost:8080/api/export-transcript-lines \
          -H 'Content-Type: application/json' \
          -d '{"words": [{"text": "Hello", "startTime": 0.0, "endTime": 0.6}], "wordsPerLine": 8}'
    """

    words = payload.words
    if not words:
        raise HTTPException(status_code=400, detail="No words provided")

    lines = build_lines_from_words(words, payload.wordsPerLine)
    lines_text = "\n".join([line.text for line in lines])

    return {"success": True, "lines": [line.model_dump() for line in lines], "linesText": lines_text}


@app.post("/api/create-animated-captions")
def create_animated_captions(payload: CreateAnimatedCaptionsRequest):
    """Create timeline subtitles synced to the provided words.

    Example:
        curl -X POST http://localhost:8080/api/create-animated-captions \
          -H 'Content-Type: application/json' \
          -d '{"words": [{"text": "Hello", "startTime": 0.0, "endTime": 0.6}]}'
    """

    success, msg = init_resolve()
    if not success:
        raise HTTPException(status_code=500, detail=msg)

    words = payload.words
    if not words:
        raise HTTPException(status_code=400, detail="No words provided")

    frame_rate = float(timeline.GetSetting("timelineFrameRate"))
    lines = build_lines_from_words(words, payload.wordsPerLine)

    track_count = timeline.GetTrackCount("subtitle")
    if track_count == 0:
        timeline.AddTrack("subtitle")

    created_count = 0
    for line in lines:
        start_frame = int(line.startTime * frame_rate)
        end_frame = int(line.endTime * frame_rate)

        result = timeline.CreateSubtitle(line.text, start_frame)
        if result:
            created_count += 1

    return {"success": True, "created": created_count, "lines": [line.model_dump() for line in lines]}


@app.post("/api/export-srt")
def export_srt(payload: ExportSrtRequest, background_tasks: BackgroundTasks):
    """Export an SRT file and queue an import into Resolve.

    Example:
        curl -X POST http://localhost:8080/api/export-srt \
          -H 'Content-Type: application/json' \
          -d '{"lines": [{"text": "Hello world", "startTime": 0, "endTime": 2}], "fileName": "demo"}'
    """

    lines = payload.lines
    if not lines:
        if not payload.words:
            raise HTTPException(status_code=400, detail="No lines or words provided")
        lines = build_lines_from_words(payload.words, payload.wordsPerLine)

    srt_path = write_srt_file(lines, payload.fileName)
    job = None
    if payload.enqueueImport:
        background_tasks.add_task(enqueue_import_job, srt_path)
        job = {"status": "queued", "filePath": str(srt_path)}

    return {
        "success": True,
        "filePath": str(srt_path),
        "lines": [line.model_dump() for line in lines],
        "job": job,
    }


if __name__ == "__main__":
    # Example: uvicorn main:app --reload --host 0.0.0.0 --port 8080
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
