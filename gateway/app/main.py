import asyncio
from app.config import settings
from app.ssh_server import start_gateway


async def main():
    print(f"SSH Gateway starting on {settings.ssh_host}:{settings.ssh_port}")
    await start_gateway()


if __name__ == "__main__":
    asyncio.run(main())
