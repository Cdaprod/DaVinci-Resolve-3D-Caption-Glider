import importlib
import json
from pathlib import Path

import httpx
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


def test_root_serves_ui(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    resp = client.get("/")
    assert resp.status_code == 200
    assert "<html" in resp.text.lower()
    assert "captioner" in resp.text.lower()
    assert "animation-helpers.js" in resp.text
    assert "lighting-rig.js" in resp.text
    assert "/public/localStorage.json" in resp.text
    assert "computeDesiredFov" in resp.text
    assert "pendingRemovalGroup" in resp.text
    assert "getActiveTimelineIndex" in resp.text
    assert "startReveal(current.meshes[0]" in resp.text
    assert "stackedGroups.push(lineObj.group)" in resp.text


def test_root_static_aliases(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    helpers = client.get("/animation-helpers.js")
    assert helpers.status_code == 200
    assert "AnimationHelpers" in helpers.text

    rig = client.get("/lighting-rig.js")
    assert rig.status_code == 200
    assert "CaptionLighting" in rig.text


def test_derive_srt_url_captions_dir(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    url = "http://192.168.0.25:8787/media/Proj/ingest/originals/demo.mp4?source=primary"
    expected = "http://192.168.0.25:8787/media/Proj/captions/demo.srt"
    assert mod.derive_srt_url(url, "captions_dir") == expected

    url_ingest = "http://192.168.0.25:8787/media/Proj/ingest/demo.mp4"
    expected_ingest = "http://192.168.0.25:8787/media/Proj/captions/demo.srt"
    assert mod.derive_srt_url(url_ingest, "captions_dir") == expected_ingest


def test_parse_srt_outputs_cues(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    srt_text = "1\n00:00:00,000 --> 00:00:01,000\nHello\n\n2\n00:00:02,000 --> 00:00:03,000\nWorld\n"
    cues = mod.parse_srt(srt_text)
    assert cues == [
        {"startMs": 0, "endMs": 1000, "text": "Hello"},
        {"startMs": 2000, "endMs": 3000, "text": "World"},
    ]


def test_captions_endpoints_return_expected_payloads(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)
    srt_text = "1\n00:00:00,000 --> 00:00:01,000\nHello\n\n"

    async def fake_fetch(url):
        return srt_text

    monkeypatch.setattr(mod, "fetch_srt_text", fake_fetch)

    media_url = "http://host/media/Proj/ingest/originals/demo.mp4"
    resp = client.get("/api/captions/cues", params={"media_url": media_url})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["media_url"] == media_url
    assert payload["srt_url"].endswith("/media/Proj/captions/demo.srt")
    assert payload["cues"] == [{"startMs": 0, "endMs": 1000, "text": "Hello"}]

    active = client.get("/api/captions/active", params={"media_url": media_url, "t_ms": 500})
    assert active.status_code == 200
    assert active.json()["text"] == "Hello"

    srt_resp = client.get("/api/captions/srt", params={"media_url": media_url})
    assert srt_resp.status_code == 200
    assert "Hello" in srt_resp.text


def test_fetch_srt_text_wraps_network_errors(tmp_path, monkeypatch):
    client, mod = build_client(tmp_path, monkeypatch)

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            raise httpx.RequestError("boom", request=httpx.Request("GET", url))

    monkeypatch.setattr(mod.httpx, "AsyncClient", lambda timeout: StubClient())

    resp = client.get("/api/captions/srt", params={"media_url": "http://host/media/Proj/ingest/demo.mp4"})
    assert resp.status_code == 502
    assert "Failed fetching SRT" in resp.text
