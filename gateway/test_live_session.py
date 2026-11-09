import asyncio
import os
import sys
import httpx
import asyncssh
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.ssh_server import start_gateway

async def run_integration_test():
    # 1. Start gateway server in background
    gateway_server = await start_gateway()
    print("✔ Gateway SSH server started on port 2222")

    # 2. Login as Employee Rahul
    async with httpx.AsyncClient() as client:
        login_res = await client.post(
            "http://localhost:3000/api/auth/login",
            json={"email": "rahul@example.com", "password": "rahulPass123!"},
        )
        if login_res.status_code != 200:
            raise RuntimeError(f"Employee login failed: {login_res.text}")
        emp_token = login_res.json()["token"]
        emp_id = login_res.json()["user"]["id"]
        print(f"✔ Employee authenticated (ID: {emp_id})")

        # 3. Request access to Server 2 (db-prod-01)
        req_res = await client.post(
            "http://localhost:3000/api/access-requests",
            headers={"Authorization": f"Bearer {emp_token}"},
            json={"serverId": 2, "duration": 30, "reason": "Test interactive PTY session"},
        )
        if req_res.status_code == 201:
            req_id = req_res.json()["id"]
            print(f"✔ Access request submitted (ID: {req_id})")

            # 4. Login as Manager Bob and Approve
            mgr_login = await client.post(
                "http://localhost:3000/api/auth/login",
                json={"email": "boss@example.com", "password": "bobManager789$"},
            )
            mgr_token = mgr_login.json()["token"]
            
            approve_res = await client.post(
                f"http://localhost:3000/api/manager/access-requests/{req_id}/approve",
                headers={"Authorization": f"Bearer {mgr_token}"},
                json={"duration": 30, "approvalReason": "Approved for live test"},
            )
            if approve_res.status_code != 200:
                raise RuntimeError(f"Approval failed: {approve_res.text}")
            print("✔ Manager approved request; JIT grant cached in Redis")
        elif "already have an active grant" in req_res.text:
            print("✔ Existing active grant found in Redis, proceeding to connect")
        else:
            raise RuntimeError(f"Access request failed: {req_res.text}")

    # 5. Connect via SSH through Gateway (Port 2222)
    print("\n--- Connecting via SSH Gateway (employee_1_server_2@localhost:2222) ---")
    conn = await asyncssh.connect(
        "localhost",
        port=2222,
        username="employee_1_server_2",
        password="rahulPass123!",
        known_hosts=None,
        config=None,
        agent_path=None,
        x509_trusted_cert_paths=None,
        x509_trusted_certs=None,
    )
    print("✔ SSH Handshake & Authentication Successful!")

    # 6. Request interactive PTY process
    proc = await conn.create_process(term_type="xterm-256color", term_size=(80, 24), encoding="utf-8")
    
    async def read_until(expected_sub: str, timeout: float = 4.0) -> str:
        accumulated = ""
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            try:
                chunk = await asyncio.wait_for(proc.stdout.read(1024), timeout=0.6)
                accumulated += chunk
                if expected_sub in accumulated:
                    return accumulated
            except asyncio.TimeoutError:
                if accumulated and expected_sub in accumulated:
                    return accumulated
        return accumulated

    # Wait for initial prompt
    initial_output = await read_until("$", timeout=4.0)
    print(f"✔ Initial Target Shell Output:\n{repr(initial_output)}")
    assert "OpenSSH" in initial_output or "$" in initial_output, "Expected target shell prompt!"

    # 7. Send 'whoami'
    print("Sending: whoami")
    proc.stdin.write("whoami\n")
    whoami_out = await read_until("employee", timeout=4.0)
    print(f"✔ Response to whoami:\n{repr(whoami_out)}")
    assert "employee" in whoami_out, "Expected whoami to return employee"

    # 8. Send 'uname -a'
    print("Sending: uname -a")
    proc.stdin.write("uname -a\n")
    uname_out = await read_until("Linux", timeout=4.0)
    print(f"✔ Response to uname -a:\n{repr(uname_out)}")
    assert "Linux" in uname_out, "Expected uname -a to return Linux"

    # 9. Exit session
    print("Sending: exit")
    proc.stdin.write("exit\n")
    await asyncio.sleep(0.5)
    
    conn.close()
    gateway_server.close()
    await gateway_server.wait_closed()
    from app.revocation import revocation_listener
    await revocation_listener.stop()
    print("\n========================================================")
    print("🎉 LIVE SSH INTERACTIVE PTY & COMMAND TEST PASSED 100%!")
    print("========================================================")

if __name__ == "__main__":
    asyncio.run(run_integration_test())

