import asyncio
import sys
from pathlib import Path

# Ensure gateway directory is in sys.path so 'app.*' imports work from anywhere
gateway_root = Path(__file__).resolve().parent.parent
if str(gateway_root) not in sys.path:
    sys.path.insert(0, str(gateway_root))

from app.config import settings
from app.ssh_server import start_gateway


async def main():
    print(f"SSH Gateway starting on {settings.ssh_host}:{settings.ssh_port}")
    await start_gateway()


if __name__ == "__main__":
    asyncio.run(main())
