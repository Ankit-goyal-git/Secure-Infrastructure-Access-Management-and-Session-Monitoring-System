import asyncio
import sys
import httpx
import asyncssh
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

async def test_multi_server_grants():
    print("\n========================================================")
    print("🚀 TESTING MULTI-SERVER ACTIVE GRANTS END-TO-END")
    print("========================================================\n")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Login as Employee Rahul
        emp_res = await client.post(
            "http://localhost:3000/api/auth/login",
            json={"email": "rahul@example.com", "password": "rahulPass123!"},
        )
        assert emp_res.status_code == 200, f"Employee login failed: {emp_res.text}"
        emp_token = emp_res.json()["token"]
        emp_id = emp_res.json()["user"]["id"]
        print(f"✔ 1. Employee Rahul authenticated (User ID: {emp_id})")

        # 2. Login as Manager Bob
        mgr_res = await client.post(
            "http://localhost:3000/api/auth/login",
            json={"email": "boss@example.com", "password": "bobManager789$"},
        )
        assert mgr_res.status_code == 200, f"Manager login failed: {mgr_res.text}"
        mgr_token = mgr_res.json()["token"]
        print("✔ 2. Manager Bob authenticated")

        # 3. Clean up any existing active grants or sessions to start fresh
        active_sess_res = await client.get(
            "http://localhost:3000/api/manager/active-sessions",
            headers={"Authorization": f"Bearer {mgr_token}"},
        )
        if active_sess_res.status_code == 200:
            for s in active_sess_res.json():
                if int(s.get("userId", 0)) == int(emp_id):
                    await client.post(
                        f"http://localhost:3000/api/manager/active-sessions/{s['id']}/revoke",
                        headers={"Authorization": f"Bearer {mgr_token}"},
                        json={"reason": "Cleanup for multi-server test"},
                    )

        # 4. Request & Approve access for Server 1 (demo-server)
        req1_res = await client.post(
            "http://localhost:3000/api/access-requests",
            headers={"Authorization": f"Bearer {emp_token}"},
            json={"serverId": 1, "duration": 25, "reason": "Multi-server test Server 1"},
        )
        if req1_res.status_code == 201:
            req1_id = req1_res.json()["id"]
            appr1_res = await client.post(
                f"http://localhost:3000/api/manager/access-requests/{req1_id}/approve",
                headers={"Authorization": f"Bearer {mgr_token}"},
                json={"duration": 25, "approvalReason": "Approved Server 1"},
            )
            assert appr1_res.status_code == 200
            print(f"✔ 3. Server 1 grant requested & approved (Request ID: {req1_id})")
        else:
            print(f"ℹ Server 1 request status {req1_res.status_code}: {req1_res.text}")

        # 5. Request & Approve access for Server 2 (db-prod-01) simultaneously
        req2_res = await client.post(
            "http://localhost:3000/api/access-requests",
            headers={"Authorization": f"Bearer {emp_token}"},
            json={"serverId": 2, "duration": 35, "reason": "Multi-server test Server 2"},
        )
        if req2_res.status_code == 201:
            req2_id = req2_res.json()["id"]
            appr2_res = await client.post(
                f"http://localhost:3000/api/manager/access-requests/{req2_id}/approve",
                headers={"Authorization": f"Bearer {mgr_token}"},
                json={"duration": 35, "approvalReason": "Approved Server 2"},
            )
            assert appr2_res.status_code == 200
            print(f"✔ 4. Server 2 grant requested & approved (Request ID: {req2_id})")
        else:
            print(f"ℹ Server 2 request status {req2_res.status_code}: {req2_res.text}")

        # 6. Verify Employee Dashboard API returns BOTH approved grants with countdown metadata
        hist_res = await client.get(
            "http://localhost:3000/api/access-requests",
            headers={"Authorization": f"Bearer {emp_token}"},
        )
        assert hist_res.status_code == 200
        history = hist_res.json()

        server1_grant = next((r for r in history if int(r["serverId"]) == 1 and r["status"] == "approved"), None)
        server2_grant = next((r for r in history if int(r["serverId"]) == 2 and r["status"] == "approved"), None)

        assert server1_grant is not None, "Expected active approved grant for Server 1"
        assert server2_grant is not None, "Expected active approved grant for Server 2"
        assert server1_grant.get("expiresAt") is not None, "Server 1 grant must have expiresAt"
        assert server2_grant.get("expiresAt") is not None, "Server 2 grant must have expiresAt"

        print(f"✔ 5. Multi-Server active grants verified:")
        print(f"     Card 1: {server1_grant['serverName']} (ID: {server1_grant['serverId']}) • Expires: {server1_grant['expiresAt']}")
        print(f"             Command: ssh employee_{emp_id}_server_{server1_grant['serverId']}@localhost -p 2222")
        print(f"     Card 2: {server2_grant['serverName']} (ID: {server2_grant['serverId']}) • Expires: {server2_grant['expiresAt']}")
        print(f"             Command: ssh employee_{emp_id}_server_{server2_grant['serverId']}@localhost -p 2222")

    # 7. Connect via SSH to Server 1
    print("\n--- Connecting to Server 1 via Gateway (employee_1_server_1@localhost:2222) ---")
    conn1 = await asyncssh.connect(
        "localhost",
        port=2222,
        username=f"employee_{emp_id}_server_1",
        password="rahulPass123!",
        known_hosts=None,
        config=None,
        agent_path=None,
        x509_trusted_cert_paths=[],
        x509_trusted_certs=[],
    )
    proc1 = await conn1.create_process(term_type="xterm-256color", term_size=(80, 24), encoding="utf-8")
    await asyncio.sleep(0.4)
    out1 = await proc1.stdout.read(1024)
    print(f"✔ 6. Connected to Server 1: {repr(out1[:40])}")

    # 8. Connect via SSH to Server 2 simultaneously
    print("\n--- Connecting to Server 2 via Gateway (employee_1_server_2@localhost:2222) ---")
    conn2 = await asyncssh.connect(
        "localhost",
        port=2222,
        username=f"employee_{emp_id}_server_2",
        password="rahulPass123!",
        known_hosts=None,
        config=None,
        agent_path=None,
        x509_trusted_cert_paths=[],
        x509_trusted_certs=[],
    )
    proc2 = await conn2.create_process(term_type="xterm-256color", term_size=(80, 24), encoding="utf-8")
    await asyncio.sleep(0.4)
    out2 = await proc2.stdout.read(1024)
    print(f"✔ 7. Connected to Server 2 simultaneously: {repr(out2[:40])}")

    # 9. Verify both commands execute independently
    proc1.stdin.write("whoami\n")
    ans1 = ""
    for _ in range(6):
        try:
            chunk1 = await asyncio.wait_for(proc1.stdout.read(1024), timeout=2.0)
            ans1 += chunk1
            if "employee" in ans1:
                break
        except asyncio.TimeoutError:
            pass

    proc2.stdin.write("whoami\n")
    ans2 = ""
    for _ in range(6):
        try:
            chunk2 = await asyncio.wait_for(proc2.stdout.read(1024), timeout=2.0)
            ans2 += chunk2
            if "employee" in ans2:
                break
        except asyncio.TimeoutError:
            pass

    print(f"✔ 8. Server 1 command output: {repr(ans1)}")
    print(f"✔ 9. Server 2 command output: {repr(ans2)}")
    assert "employee" in ans1, f"Expected 'employee' in Server 1 output, got {repr(ans1)}"
    assert "employee" in ans2, f"Expected 'employee' in Server 2 output, got {repr(ans2)}"

    conn1.close()
    conn2.close()

    print("\n========================================================")
    print("🎉 MULTI-SERVER ACTIVE GRANTS PASSED 100%!")
    print("========================================================\n")

if __name__ == "__main__":
    asyncio.run(test_multi_server_grants())
