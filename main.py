"""Compatibility entrypoint that forwards to app.main.app.

Example: uvicorn main:app --host 0.0.0.0 --port 8791
"""
from app.main import app  # noqa: F401
