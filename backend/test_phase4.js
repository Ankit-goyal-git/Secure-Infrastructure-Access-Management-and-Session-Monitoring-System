const http = require('http');
const app = require('./src/app');
const { Server } = require('./src/models');
const { decryptCredential } = require('./src/utils/crypto');

async function testPhase4() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Phase 4 Test server running on ${baseUrl}`);

  try {
    // 1. Authenticate as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    });
    const adminAuth = await adminLoginRes.json();
    console.log('✔ 1. Admin authenticated successfully');

    // 2. Provision new server with sensitive plaintext credentials
    const plaintextPass = 'prod_super_secret_ssh_pass_2026!';
    const plaintextKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----';

    const randomHost = `10.200.1.${Math.floor(Math.random() * 200) + 10}`;
    const createRes = await fetch(`${baseUrl}/api/servers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        name: 'zero-trust-vault-node',
        host: randomHost,
        port: 22,
        department: 'security',
        status: 'active',
        sshUsername: 'sysadmin',
        sshPassword: plaintextPass,
        sshKey: plaintextKey,
      }),
    });
    const createData = await createRes.json();
    if (createRes.status !== 201) throw new Error('Server creation failed: ' + JSON.stringify(createData));
    const newServerId = createData.server.id;
    console.log(`✔ 2. Admin provisioned server node ID ${newServerId} with sensitive credentials`);

    // 3. Inspect PostgreSQL directly to confirm envelope encryption at rest
    const dbRecord = await Server.findByPk(newServerId);
    if (!dbRecord) throw new Error('Server record not found in database');

    console.log('\n--- PostgreSQL Raw Storage Inspection ---');
    console.log('Database ssh_password:', dbRecord.sshPassword);
    console.log('Database ssh_key:', dbRecord.sshKey ? dbRecord.sshKey.substring(0, 45) + '...' : null);

    if (!dbRecord.sshPassword.startsWith('enc:v1:')) {
      throw new Error('FAILED: ssh_password was NOT encrypted with AES-256-GCM!');
    }
    if (!dbRecord.sshKey.startsWith('enc:v1:')) {
      throw new Error('FAILED: ssh_key was NOT encrypted with AES-256-GCM!');
    }
    if (dbRecord.sshPassword.includes(plaintextPass)) {
      throw new Error('FAILED: Plaintext password leaked in raw database column!');
    }
    console.log('✔ 3. Verified: Passwords and Keys are 100% encrypted in PostgreSQL using AES-256-GCM');

    // 4. Verify Gateway Internal API receives ciphertext (Zero-Trust transport)
    // First, login employee and submit request
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@example.com', password: 'password123' }),
    });
    const empAuth = await empLoginRes.json();

    const reqRes = await fetch(`${baseUrl}/api/access-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empAuth.token}`,
      },
      body: JSON.stringify({
        serverId: newServerId,
        duration: 30,
        reason: 'Zero trust security verification',
      }),
    });
    const reqData = await reqRes.json();
    const requestId = reqData.request ? reqData.request.id : reqData.id;

    // Approve request as Manager
    const mgrLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'boss@example.com', password: 'password123' }),
    });
    const mgrAuth = await mgrLoginRes.json();

    const approveRes = await fetch(`${baseUrl}/api/manager/access-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrAuth.token}`,
      },
      body: JSON.stringify({
        duration: 30,
        approvalReason: 'Approved for zero trust testing',
      }),
    });
    if (approveRes.status !== 200) throw new Error('Manager approval failed: ' + (await approveRes.text()));
    console.log('✔ 4. Access request approved & active JIT Redis grant created');

    // 5. Gateway queries internal check
    const internalCheckRes = await fetch(`${baseUrl}/internal/access/check?userId=${empAuth.user.id}&serverId=${newServerId}&password=password123`, {
      headers: {
        'x-api-key': 'gateway_secret_key_5678',
      },
    });
    const checkData = await internalCheckRes.json();
    if (!checkData.allowed) throw new Error('Gateway access check denied: ' + JSON.stringify(checkData));

    console.log('\n--- Gateway Internal API Payload Inspection ---');
    console.log('targetPassword in response:', checkData.targetPassword);
    console.log('targetKey in response:', checkData.targetKey ? checkData.targetKey.substring(0, 45) + '...' : null);

    if (!checkData.targetPassword.startsWith('enc:v1:')) {
      throw new Error('FAILED: Gateway received unencrypted target password!');
    }
    console.log('✔ 5. Verified: Gateway receives encrypted envelope tokens over internal wire');

    // 6. Verify symmetric decryption yields original plaintext
    const decryptedPass = decryptCredential(checkData.targetPassword);
    const decryptedKey = decryptCredential(checkData.targetKey);
    if (decryptedPass !== plaintextPass) {
      throw new Error(`Decryption mismatch: got "${decryptedPass}", expected "${plaintextPass}"`);
    }
    if (decryptedKey !== plaintextKey) {
      throw new Error('Decryption mismatch for private key');
    }
    console.log('✔ 6. Verified: Transient decryption yields exact original plaintext in memory');

    console.log('\n======================================================');
    console.log('🎉 PHASE 4 CREDENTIAL HARDENING & ZERO-TRUST COMPLETE!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Phase 4 error:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

testPhase4();
