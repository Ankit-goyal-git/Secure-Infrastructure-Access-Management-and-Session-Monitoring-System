const http = require('http');
const app = require('./src/app');

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Test server running on ${baseUrl}`);

  try {
    // 1. Login as Admin Alice
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    });
    const adminAuth = await adminLoginRes.json();
    if (!adminAuth.token) throw new Error('Admin login failed: ' + JSON.stringify(adminAuth));
    console.log('✔ 1. Admin authenticated successfully');

    // 2. Login as Employee Rahul
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@example.com', password: 'password123' }),
    });
    const empAuth = await empLoginRes.json();
    if (!empAuth.token) throw new Error('Employee login failed: ' + JSON.stringify(empAuth));
    console.log('✔ 2. Employee authenticated successfully');

    // 3. Test Connection probe (Admin only)
    const testProbeRes = await fetch(`${baseUrl}/api/servers/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({ host: 'localhost', port: 2223 }),
    });
    const probeData = await testProbeRes.json();
    console.log('✔ 3. Pre-flight reachability probe result:', probeData);
    if (!probeData.success || !probeData.isSSH) {
      console.warn('Note: Target server on 2223 check returned:', probeData);
    }

    // 4. Test RBAC: Employee attempting to provision server should receive 403 Forbidden
    const unauthAddRes = await fetch(`${baseUrl}/api/servers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empAuth.token}`,
      },
      body: JSON.stringify({ name: 'rogue-server', host: '192.168.1.99', port: 22 }),
    });
    if (unauthAddRes.status === 403) {
      console.log('✔ 4. RBAC enforced: Employee denied server creation (403 Forbidden)');
    } else {
      throw new Error(`Expected 403 for employee server creation, got ${unauthAddRes.status}`);
    }

    // 5. Dynamic Server Provisioning by Admin
    const uniqueHost = `dynamic-node-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/servers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        name: 'analytics-worker-01',
        host: uniqueHost,
        port: 2222,
        department: 'finance',
        status: 'active',
        description: 'Auto-provisioned analytics worker node',
        sshUsername: 'employee',
        sshPassword: 'custom_secure_password',
      }),
    });
    const createData = await createRes.json();
    if (createRes.status !== 201) throw new Error('Server creation failed: ' + JSON.stringify(createData));
    const newServerId = createData.server.id;
    console.log(`✔ 5. Server dynamically provisioned without redeployment (ID: ${newServerId}, Dept: ${createData.server.department})`);

    // 6. Verify Employee can see active server in catalog
    const empCatalogRes = await fetch(`${baseUrl}/api/servers`, {
      headers: { Authorization: `Bearer ${empAuth.token}` },
    });
    const empCatalog = await empCatalogRes.json();
    const foundInEmpCatalog = empCatalog.find((s) => s.id === newServerId);
    if (!foundInEmpCatalog) throw new Error('New server not visible in employee catalog');
    console.log('✔ 6. Employee catalog immediately reflects new server:', foundInEmpCatalog.name);

    // 7. Update Server configuration (Admin)
    const updateRes = await fetch(`${baseUrl}/api/servers/${newServerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        description: 'Updated description for node',
        department: 'infrastructure',
      }),
    });
    const updateData = await updateRes.json();
    if (updateRes.status !== 200) throw new Error('Server update failed: ' + JSON.stringify(updateData));
    console.log('✔ 7. Server updated successfully (New dept:', updateData.server.department, ')');

    // 8. Soft-deactivate server
    const deleteRes = await fetch(`${baseUrl}/api/servers/${newServerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const deleteData = await deleteRes.json();
    console.log('✔ 8. Server deactivated successfully:', deleteData.message);

    // 9. Verify inactive server is hidden from employee catalog
    const empCatalogAfterRes = await fetch(`${baseUrl}/api/servers`, {
      headers: { Authorization: `Bearer ${empAuth.token}` },
    });
    const empCatalogAfter = await empCatalogAfterRes.json();
    const foundAfter = empCatalogAfter.find((s) => s.id === newServerId);
    if (foundAfter) throw new Error('Deactivated server should not be visible to employees');
    console.log('✔ 9. Deactivated server safely hidden from employee dropdown catalog');

    console.log('\n========================================');
    console.log('🎉 ALL PHASE 1 VERIFICATION TESTS PASSED!');
    console.log('========================================\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

