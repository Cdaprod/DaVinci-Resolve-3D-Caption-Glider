import unittest

from fastapi.testclient import TestClient

import main


class ExportSrtTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        main.CAPTIONS_DIR.mkdir(exist_ok=True)
        for file_path in main.CAPTIONS_DIR.glob("*.srt"):
            file_path.unlink()
        main.IMPORT_QUEUE.clear()

    def test_export_srt_writes_file_and_queues_job(self):
        payload = {
            "lines": [
                {"text": "Hello world", "startTime": 0.0, "endTime": 1.5},
                {"text": "Second line", "startTime": 2.0, "endTime": 3.0},
            ],
            "fileName": "demo",
            "enqueueImport": True,
        }

        response = self.client.post("/api/export-srt", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        target = main.CAPTIONS_DIR / "demo.srt"
        self.assertTrue(target.exists())
        self.assertTrue(data["filePath"].endswith("demo.srt"))
        self.assertEqual(len(main.IMPORT_QUEUE), 1)
        self.assertIn(
            main.IMPORT_QUEUE[0]["status"],
            {"blocked", "unsupported", "failed", "completed", "queued"},
        )

        content = target.read_text(encoding="utf-8")
        self.assertIn("Hello world", content)
        self.assertIn("00:00:00,000 --> 00:00:01,500", content)


if __name__ == "__main__":
    unittest.main()
