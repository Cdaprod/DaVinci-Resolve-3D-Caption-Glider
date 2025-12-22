import importlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.main as main


def build_client(tmp_path, monkeypatch):
    monkeypatch.setenv("CAPTIONER_PROJECTS_ROOT", str(tmp_path))
    monkeypatch.delenv("MEDIA_SYNC_BASE_URL", raising=False)
    importlib.reload(main)
    return TestClient(main.app), main


def test_file_path_traversal_blocked(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    project = tmp_path / "ProjectA"
    project.mkdir()

    resp = client.get(f"/api/projects/{project.name}/file", params={"path": "../etc/passwd"})
    assert resp.status_code == 400


def test_generate_captions_writes_artifacts(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    project = tmp_path / "ProjectA"
    ingest_dir = project / "ingest"
    ingest_dir.mkdir(parents=True)
    video = ingest_dir / "demo.mp4"
    video.write_bytes(b"demo video")

    audio_out = []

    def fake_extract(video_path, audio_path):
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        audio_path.write_bytes(b"audio")
        audio_out.append(audio_path)

    def fake_transcribe(audio_path, model_size):
        assert audio_path in audio_out
        return [
            {"text": "Hello", "start": 0.0, "end": 0.5},
            {"text": "world", "start": 0.5, "end": 1.0},
            {"text": "again", "start": 1.0, "end": 1.5},
        ]

    monkeypatch.setattr(mod, "extract_audio", fake_extract)
    monkeypatch.setattr(mod, "transcribe_audio", fake_transcribe)

    sha = mod.compute_sha256(video)
    resp = client.post(
        f"/api/projects/{project.name}/media/generate-captions",
        json={"video_rel_path": "ingest/demo.mp4", "model_size": "tiny", "max_chars": 32},
    )
    assert resp.status_code == 200
    data = resp.json()

    base = f"demo__{sha[:10]}"
    words_path = project / "captions" / f"{base}.words.json"
    lines_path = project / "captions" / f"{base}.lines.txt"
    srt_path = project / "captions" / f"{base}.srt"

    assert words_path.exists()
    assert lines_path.exists()
    assert srt_path.exists()

    with words_path.open() as f:
        payload = json.load(f)
    assert payload["meta"]["sha256"] == sha
    assert "words" in payload and len(payload["words"]) == 3

    lines_text = lines_path.read_text().strip().splitlines()
    assert any("Hello" in line for line in lines_text)

    srt = srt_path.read_text()
    assert "00:00:00,000" in srt


def test_file_serving_and_allowlist(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    project = tmp_path / "ProjectA"
    captions_dir = project / "captions"
    captions_dir.mkdir(parents=True)
    lines = captions_dir / "demo.lines.txt"
    lines.write_text("hello", encoding="utf-8")

    resp = client.get(f"/api/projects/{project.name}/file", params={"path": "captions/demo.lines.txt"})
    assert resp.status_code == 200
    assert resp.text.strip() == "hello"

    blocked = client.get(f"/api/projects/{project.name}/file", params={"path": "other/demo.txt"})
    assert blocked.status_code == 400


def test_generate_captions_blocks_traversal(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    project = tmp_path / "ProjectA"
    project.mkdir()
    resp = client.post(
        f"/api/projects/{project.name}/media/generate-captions",
        json={"video_rel_path": "../bad.mp4"},
    )
    assert resp.status_code == 400
