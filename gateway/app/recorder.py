import time
import json
from pathlib import Path
from typing import Union
import httpx


class AsciinemaRecorder:
    """
    Records interactive SSH terminal sessions in Asciicast v2 format.
    Specification: https://github.com/asciinema/asciinema/blob/develop/doc/asciicast-v2.md
    """

    def __init__(self, session_id: str, width: int = 80, height: int = 24, title: str | None = None):
        self.session_id = session_id
        self.width = width
        self.height = height
        self.title = title or f"SSH Session {session_id}"
        self.start_time: float | None = None
        self.events: list[tuple[float, str, str]] = []
        self._is_recording = False

    def start(self):
        self.start_time = time.time()
        self._is_recording = True

    def set_size(self, width: int, height: int):
        self.width = width
        self.height = height

    def record_input(self, data: Union[str, bytes]):
        if not self._is_recording or self.start_time is None:
            return

        elapsed = round(time.time() - self.start_time, 4)
        text = data if isinstance(data, str) else data.decode("utf-8", errors="replace")
        self.events.append((elapsed, "i", text))

    def record_output(self, data: Union[str, bytes]):
        if not self._is_recording or self.start_time is None:
            return

        elapsed = round(time.time() - self.start_time, 4)
        text = data if isinstance(data, str) else data.decode("utf-8", errors="replace")
        self.events.append((elapsed, "o", text))

    def stop(self):
        self._is_recording = False

    def to_asciicast(self) -> str:
        header = {
            "version": 2,
            "width": self.width or 80,
            "height": self.height or 24,
            "timestamp": int(self.start_time or time.time()),
            "title": self.title,
            "env": {
                "TERM": "xterm-256color",
                "SHELL": "/bin/bash",
            },
        }

        lines = [json.dumps(header)]
        for elapsed, ev_type, content in self.events:
            lines.append(json.dumps([elapsed, ev_type, content]))

        return "\n".join(lines) + "\n"

    def save_to_file(self, file_path: Union[str, Path]):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.to_asciicast(), encoding="utf-8")

    async def upload_to_backend(self, backend_url: str, api_key: str):
        if not backend_url:
            return

        url = f"{backend_url}/internal/sessions/{self.session_id}/recording"
        headers = {
            "x-api-key": api_key,
        }
        payload = {
            "recording": self.to_asciicast(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    print(f"Session recording uploaded for {self.session_id}")
                else:
                    print(f"Backend recording upload returned status {response.status_code}")
        except Exception as exc:
            print(f"Failed to upload session recording to backend: {exc}")
