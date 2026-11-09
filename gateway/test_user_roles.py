import asyncio
import sys
import httpx
from pathlib import Path

# Add gateway root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

async def test_user_roles_and_admin():
    print("\n========================================================")
    print("🚀 TESTING USER & ROLE MANAGEMENT + DEMO SWITCHER")
    print("========================================================\n")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Verify Demo Login Credentials for All 3 Roles
        roles_to_test = [
            ("Employee", "rahul@example.com", "rahulPass123!"),
            ("Manager", "boss@example.com", "bobManager789$"),
            ("Admin", "admin@example.com", "adminMaster999@"),
        ]

        tokens = {}
        for role_name, email, password in roles_to_test:
            res = await client.post(
                "http://localhost:3000/api/auth/login",
                json={"email": email, "password": password},
            )
            assert res.status_code == 200, f"Login failed for {role_name}: {res.text}"
            data = res.json()
            assert data["user"]["role"] == role_name.lower()
            tokens[role_name.lower()] = data["token"]
            print(f"✔ 1. Demo Login verified for [{role_name}]: {data['user']['name']} (Role: {data['user']['role']})")

        admin_token = tokens["admin"]
        emp_token = tokens["employee"]

        # 2. Verify RBAC Security Guard: Employee CANNOT access Admin API
        emp_forbidden_res = await client.get(
            "http://localhost:3000/api/admin/users",
            headers={"Authorization": f"Bearer {emp_token}"},
        )
        assert emp_forbidden_res.status_code == 403, f"Expected 403 Forbidden for employee, got {emp_forbidden_res.status_code}"
        print(f"✔ 2. RBAC Guard confirmed: Employee correctly denied access to Admin API (HTTP 403)")

        # 3. Admin Fetches All Users Roster
        users_res = await client.get(
            "http://localhost:3000/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert users_res.status_code == 200, f"Admin fetch users failed: {users_res.text}"
        users = users_res.json()
        assert len(users) >= 4
        print(f"✔ 3. Admin retrieved team roster: {len(users)} users registered in database")

        # 4. Admin Creates a New Team Member with specific role
        test_email = "david.temp@example.com"
        create_res = await client.post(
            "http://localhost:3000/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "David Miller (SRE)",
                "email": test_email,
                "password": "davidSecurePassword123!",
                "role": "employee",
            },
        )
        assert create_res.status_code == 201, f"User creation failed: {create_res.text}"
        new_user = create_res.json()["user"]
        new_user_id = new_user["id"]
        print(f"✔ 4. Admin created new team member: {new_user['name']} (ID: {new_user_id}) as [{new_user['role']}]")

        # 5. Verify New User Logs In as Employee
        david_login = await client.post(
            "http://localhost:3000/api/auth/login",
            json={"email": test_email, "password": "davidSecurePassword123!"},
        )
        assert david_login.status_code == 200
        assert david_login.json()["user"]["role"] == "employee"
        print(f"✔ 5. New user David authenticated successfully as [employee]")

        # 6. Admin Promotes David to 'manager'
        promote_res = await client.patch(
            f"http://localhost:3000/api/admin/users/{new_user_id}/role",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "manager"},
        )
        assert promote_res.status_code == 200, f"Role promotion failed: {promote_res.text}"
        assert promote_res.json()["user"]["role"] == "manager"
        print(f"✔ 6. Admin promoted David to [manager] in PostgreSQL")

        # 7. Verify David logs in again and is now recognized as 'manager'
        david_mgr_login = await client.post(
            "http://localhost:3000/api/auth/login",
            json={"email": test_email, "password": "davidSecurePassword123!"},
        )
        assert david_mgr_login.status_code == 200
        assert david_mgr_login.json()["user"]["role"] == "manager"
        print(f"✔ 7. David re-authenticated and role dynamically confirmed as [manager]")

        # 8. Admin Safety Check: Admin cannot demote or delete self
        admin_id = next(u["id"] for u in users if u["email"] == "admin@example.com")
        self_demote = await client.patch(
            f"http://localhost:3000/api/admin/users/{admin_id}/role",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "employee"},
        )
        assert self_demote.status_code == 400
        print(f"✔ 8. Self-demote safety guard passed: Admin cannot demote self (HTTP 400)")

        # 9. Clean up test user
        del_res = await client.delete(
            f"http://localhost:3000/api/admin/users/{new_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert del_res.status_code == 200
        print(f"✔ 9. Cleaned up temporary test user: {test_email}")

    print("\n========================================================")
    print("🎉 USER & ROLE MANAGEMENT PASSED 100%!")
    print("========================================================\n")

if __name__ == "__main__":
    asyncio.run(test_user_roles_and_admin())

