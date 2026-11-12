#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"
chmod 600 "$DIR/../gateway_host_key" 2>/dev/null || true
exec "$DIR/.venv/bin/python3" app/main.py
