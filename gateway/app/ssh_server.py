import asyncio
import asyncssh


GATEWAY_HOST = "0.0.0.0"
GATEWAY_PORT = 2222

TARGET_HOST = "localhost"
TARGET_PORT = 2223

TARGET_USERNAME = "employee"
TARGET_PASSWORD = "employee123"


class GatewaySSHServer(asyncssh.SSHServer):
    def connection_made(self, conn):
        print("SSH client connected")

    def connection_lost(self, exc):
        if exc:
            print(f"SSH connection lost: {exc}")
        else:
            print("SSH client disconnected")

    def begin_auth(self, username):
        return True

    def password_auth_supported(self):
        return True

    async def validate_password(self, username, password):
        return (
            username == TARGET_USERNAME
            and password == TARGET_PASSWORD
        )


async def start_gateway():
    await asyncssh.create_server(
        GatewaySSHServer,
        GATEWAY_HOST,
        GATEWAY_PORT,
        server_host_keys=["gateway_host_key"],
    )

    print(f"SSH Gateway listening on {GATEWAY_HOST}:{GATEWAY_PORT}")

    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(start_gateway())