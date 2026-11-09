import asyncio
import sys
import httpx
import asyncssh
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

async def test_active_revocation():
    print("\n========================================================")
    print("🚀 TESTING REAL-TIME ACTIVE REVOCATION END-TO-END")
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
        print(f"✔ 1. Employee Rahul authenticated (ID: {emp_id})")

        # 2. Login as Manager Bob
        mgr_res = await client.post(
            "http://localhost:3000/api/auth/login",
            json={"email": "boss@example.com", "password": "bobManager789$"},
        )
        assert mgr_res.status_code == 200, f"Manager login failed: {mgr_res.text}"
        mgr_token = mgr_res.json()["token"]
        print("✔ 2. Manager Bob authenticated")

        # 3. Check if there are pending requests or existing approved grants
        hist_res = await client.get(
            "http://localhost:3000/api/access-requests",
            headers={"Authorization": f"Bearer {emp_token}"},
        )
        approved_req = next((r for r in hist_res.json() if int(r["serverId"]) == 2 and r["status"] == "approved"), None)

        if not approved_req:
            # Check pending requests for manager
            pending_res = await client.get(
                "http://localhost:3000/api/manager/access-requests",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            target_pending = next((r for r in pending_res.json() if int(r["server"]["id"]) == 2 and int(r["user"]["id"]) == int(emp_id)), None)

            if target_pending:
                req_id = target_pending["id"]
            else:
                # Submit new access request
                req_res = await client.post(
                    "http://localhost:3000/api/access-requests",
                    headers={"Authorization": f"Bearer {emp_token}"},
                    json={"serverId": 2, "duration": 30, "reason": "Test active revocation sync"},
                )
                assert req_res.status_code == 201, f"Failed to submit request: {req_res.text}"
                req_id = req_res.json()["id"]
                print(f"✔ 3. Access request submitted (ID: {req_id})")

            # Approve the request
            appr_res = await client.post(
                f"http://localhost:3000/api/manager/access-requests/{req_id}/approve",
                headers={"Authorization": f"Bearer {mgr_token}"},
                json={"duration": 30, "approvalReason": "Approved for revocation test"},
            )
            assert appr_res.status_code == 200, f"Approval failed: {appr_res.text}"
            print("✔ 4. Manager Bob approved request")

            # Verify Employee history shows 'approved'
            hist_res = await client.get(
                "http://localhost:3000/api/access-requests",
                headers={"Authorization": f"Bearer {emp_token}"},
            )
            approved_req = next((r for r in hist_res.json() if int(r["serverId"]) == 2 and r["status"] == "approved"), None)
            assert approved_req is not None, "Expected approved request in history"

        print(f"✔ 5. Employee dashboard API confirms status='approved' for Request #{approved_req['id']}")

    # 7. Connect via SSH through Gateway (Port 2222)
    print("\n--- Connecting to SSH Gateway (employee_1_server_2@localhost:2222) ---")
    conn = await asyncssh.connect(
        "localhost",
        port=2222,
        username="employee_1_server_2",
        password="rahulPass123!",
        known_hosts=None,
        config=None,
        agent_path=None,
        x509_trusted_cert_paths=[],
        x509_trusted_certs=[],
    )
    print("✔ 6. SSH Handshake successful")

    proc = await conn.create_process(term_type="xterm-256color", term_size=(80, 24), encoding="utf-8")
    
    # Read initial prompt
    initial = await proc.stdout.read(1024)
    print(f"✔ 7. Shell connected! Target Output:\n{repr(initial)}")

    # Execute a command to verify interactive channel
    proc.stdin.write("whoami\n")
    whoami_out = ""
    for _ in range(5):
        chunk = await asyncio.wait_for(proc.stdout.read(1024), timeout=2.0)
        whoami_out += chunk
        if "employee" in whoami_out:
            break
    print(f"✔ 8. Command 'whoami' succeeded: {repr(whoami_out)}")
    assert "employee" in whoami_out

    # 8. While terminal is actively open, Manager calls revokeActiveSession
    print("\n--- Manager triggers ACTIVE REVOCATION from Web Portal ---")
    async with httpx.AsyncClient(timeout=10.0) as client:
        active_sess_res = await client.get(
            "http://localhost:3000/api/manager/active-sessions",
            headers={"Authorization": f"Bearer {mgr_token}"},
        )
        assert active_sess_res.status_code == 200
        active_sessions = active_sess_res.json()
        print(f"Active sessions reported by backend: {active_sessions}")
        target_session = next((s for s in active_sessions if int(s.get("userId")) == int(emp_id) and int(s.get("serverId")) == 2), None)
        assert target_session is not None, "Target active session not found in manager active sessions list!"
        sess_id = target_session["id"]
        print(f"✔ 9. Found active session in Manager view: {sess_id}")

        revoke_res = await client.post(
            f"http://localhost:3000/api/manager/active-sessions/{sess_id}/revoke",
            headers={"Authorization": f"Bearer {mgr_token}"},
            json={"reason": "Security audit test revocation"},
        )
        assert revoke_res.status_code == 200
        print(f"✔ 10. Manager revoked session {sess_id}: {revoke_res.json()}")

    # 9. Read terminal output to verify [ACCESS REVOKED] banner was written
    print("\n--- Verifying SSH Terminal Disconnection & Sever Notice ---")
    sever_output = ""
    try:
        while not proc.stdout.at_eof():
            chunk = await asyncio.wait_for(proc.stdout.read(1024), timeout=2.0)
            if not chunk:
                break
            sever_output += chunk
    except (asyncio.TimeoutError, asyncssh.ConnectionLost):
        pass

    print(f"✔ 11. Received Terminal Alert:\n{sever_output}")
    assert "ACCESS REVOKED" in sever_output, "Expected [ACCESS REVOKED] banner in terminal output!"
    assert "revoked by a manager" in sever_output, "Expected revocation explanation in terminal output!"

    # 10. Verify Employee Dashboard API now reports 'revoked'
    async with httpx.AsyncClient(timeout=10.0) as client:
        hist_res2 = await client.get(
            "http://localhost:3000/api/access-requests",
            headers={"Authorization": f"Bearer {emp_token}"},
        )
        assert hist_res2.status_code == 200
        revoked_req = next((r for r in hist_res2.json() if int(r["serverId"]) == 2), None)
        assert revoked_req is not None
        print(f"✔ 12. Employee dashboard API now reports status='{revoked_req['status']}'")
        assert revoked_req["status"] == "revoked", f"Expected request status to be 'revoked', got '{revoked_req['status']}'"

    conn.close()
    print("\n========================================================")
    print("🎉 REAL-TIME ACTIVE REVOCATION PASSED 100%!")
    print("========================================================\n")

if __name__ == "__main__":
    asyncio.run(test_active_revocation())
