const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const metrics = require('../src/metrics');
const alerts = require('../src/alerts');

describe('Monitoring Subsystem Tests', () => {
  beforeEach(() => {
    // Reset DB state and Metrics before each test
    db.resetDbState();
    metrics.resetActiveSessions();
    alerts.resetAlertState();
  });

  afterAll(async () => {
    // Clean up
    await db.closeDb();
  });

  // 1. Valid event accepted
  test('1. Valid event accepted', async () => {
    const response = await request(app)
      .post('/events')
      .send({
        event_id: 'e2056df6-3023-4554-b52b-2a6d88c031c2',
        event_type: 'SESSION_CREATED',
        timestamp: '2026-08-21T18:10:00.000Z',
        user_id: 1,
        server_id: 1,
        session_id: '0f0f9a1c-1234-4567-8901-123456789abc',
        result: 'SUCCESS',
        metadata: { client: '127.0.0.1' }
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.event_id).toBe('e2056df6-3023-4554-b52b-2a6d88c031c2');
  });

  // 2. Invalid event rejected
  test('2. Invalid event rejected', async () => {
    const response = await request(app)
      .post('/events')
      .send({
        event_type: 'INVALID_EVENT_TYPE_123',
        result: 'SUCCESS'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Validation Error');
  });

  // 3. Missing event_id generated
  test('3. Missing event_id generated', async () => {
    const response = await request(app)
      .post('/events')
      .send({
        event_type: 'SESSION_CREATED',
        user_id: 1,
        server_id: 1,
        session_id: '0f0f9a1c-1234-4567-8901-123456789abc',
        result: 'SUCCESS'
      });

    expect(response.status).toBe(201);
    expect(response.body.event_id).toBeDefined();
    expect(typeof response.body.event_id).toBe('string');
  });

  // 4. Missing timestamp generated
  test('4. Missing timestamp generated', async () => {
    await request(app)
      .post('/events')
      .send({
        event_type: 'LOGIN_SUCCESS',
        user_id: 1,
        result: 'SUCCESS'
      });

    const logs = await db.queryAuditLogs({ event_type: 'LOGIN_SUCCESS' });
    expect(logs.length).toBe(1);
    expect(logs[0].timestamp).toBeDefined();
    expect(new Date(logs[0].timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  // 5. SESSION_CREATED increments active sessions
  test('5. SESSION_CREATED increments active sessions', async () => {
    expect(metrics.getActiveSessionCount()).toBe(0);

    await request(app)
      .post('/events')
      .send({
        event_type: 'SESSION_CREATED',
        session_id: '0f0f9a1c-1234-4567-8901-123456789abc',
        user_id: 1,
        server_id: 1
      });

    expect(metrics.getActiveSessionCount()).toBe(1);
  });

  // 6. SESSION_ENDED decrements active sessions
  test('6. SESSION_ENDED decrements active sessions', async () => {
    const session_id = '0f0f9a1c-1234-4567-8901-123456789abc';
    
    // Create session
    await request(app)
      .post('/events')
      .send({
        event_type: 'SESSION_CREATED',
        session_id,
        user_id: 1,
        server_id: 1
      });

    expect(metrics.getActiveSessionCount()).toBe(1);

    // End session
    await request(app)
      .post('/events')
      .send({
        event_type: 'SESSION_ENDED',
        session_id,
        user_id: 1,
        server_id: 1
      });

    expect(metrics.getActiveSessionCount()).toBe(0);
  });

  // 7. ACCESS_EXPIRED handles active session correctly
  test('7. ACCESS_EXPIRED handles active session correctly', async () => {
    const session_id = '0f0f9a1c-1234-4567-8901-123456789abc';

    // Create session
    await request(app)
      .post('/events')
      .send({
        event_type: 'SESSION_CREATED',
        session_id,
        user_id: 1,
        server_id: 1
      });

    expect(metrics.getActiveSessionCount()).toBe(1);

    // Expire access
    await request(app)
      .post('/events')
      .send({
        event_type: 'ACCESS_EXPIRED',
        session_id,
        user_id: 1,
        server_id: 1
      });

    expect(metrics.getActiveSessionCount()).toBe(0);
  });

  // 8. Active sessions never becomes negative
  test('8. Active sessions never becomes negative', async () => {
    // End session that was never created
    await request(app)
      .post('/events')
      .send({
        event_type: 'SESSION_ENDED',
        session_id: 'non-existent-session-id',
        user_id: 1,
        server_id: 1
      });

    expect(metrics.getActiveSessionCount()).toBe(0);
  });

  // Helper to extract Prom metric value
  async function getMetricValue(metricName) {
    const res = await request(app).get('/metrics');
    const lines = res.text.split('\n');
    const targetLine = lines.find(l => l.startsWith(metricName) && !l.startsWith('#'));
    if (!targetLine) return 0;
    const parts = targetLine.trim().split(/\s+/);
    return parseFloat(parts[parts.length - 1]);
  }

  // 9. COMMAND_ALLOWED increments correct metric
  test('9. COMMAND_ALLOWED increments correct metric', async () => {
    const initial = await getMetricValue('command_allowed_total');

    await request(app)
      .post('/events')
      .send({
        event_type: 'COMMAND_ALLOWED',
        user_id: 1,
        session_id: '0f0f9a1c-1234-4567-8901-123456789abc',
        result: 'ALLOWED',
        metadata: { command: 'whoami' }
      });

    const final = await getMetricValue('command_allowed_total');
    expect(final - initial).toBe(1);
  });

  // 10. COMMAND_BLOCKED increments blocked metric
  test('10. COMMAND_BLOCKED increments blocked metric', async () => {
    const initial = await getMetricValue('blocked_actions_total');

    await request(app)
      .post('/events')
      .send({
        event_type: 'COMMAND_BLOCKED',
        user_id: 1,
        session_id: '0f0f9a1c-1234-4567-8901-123456789abc',
        result: 'BLOCKED',
        metadata: { command: 'cat /etc/shadow' }
      });

    const final = await getMetricValue('blocked_actions_total');
    expect(final - initial).toBe(1);
  });

  // 11. Authorization failures increment metric
  test('11. Authorization failures increment metric', async () => {
    const initial = await getMetricValue('authorization_failures_total');

    await request(app)
      .post('/events')
      .send({
        event_type: 'LOGIN_FAILURE',
        user_id: 2,
        result: 'FAILURE'
      });

    const final = await getMetricValue('authorization_failures_total');
    expect(final - initial).toBe(1);
  });

  // 12. Repeated failures create SECURITY_ALERT
  test('12. Repeated failures create SECURITY_ALERT', async () => {
    // Send ALERT_FAILURE_THRESHOLD consecutive failures
    const failuresNeeded = alerts.ALERT_FAILURE_THRESHOLD;

    for (let i = 0; i < failuresNeeded; i++) {
      await request(app)
        .post('/events')
        .send({
          event_type: 'LOGIN_FAILURE',
          user_id: 10,
          result: 'FAILURE'
        });
    }

    // Wait a brief tick for async evaluation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify SECURITY_ALERT event was generated and stored
    const alertLogs = await db.queryAuditLogs({ event_type: 'SECURITY_ALERT' });
    expect(alertLogs.length).toBe(1);
    expect(alertLogs[0].event_data.metadata.alert_type).toBe('BRUTE_FORCE_BYPASS_ATTEMPT');

    const dbAlerts = await db.querySecurityAlerts();
    expect(dbAlerts.length).toBe(1);
    expect(dbAlerts[0].rule).toBe('BRUTE_FORCE_BYPASS_ATTEMPT');
  });

  // 13. Repeated blocked actions create SECURITY_ALERT
  test('13. Repeated blocked actions create SECURITY_ALERT', async () => {
    const blocksNeeded = alerts.ALERT_BLOCK_THRESHOLD;
    const session_id = '11111111-2222-3333-4444-555555555555';

    for (let i = 0; i < blocksNeeded; i++) {
      await request(app)
        .post('/events')
        .send({
          event_type: 'COMMAND_BLOCKED',
          user_id: 12,
          session_id,
          result: 'BLOCKED',
          metadata: { command: 'cat /etc/shadow' }
        });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const alertLogs = await db.queryAuditLogs({ event_type: 'SECURITY_ALERT' });
    expect(alertLogs.length).toBe(1);
    expect(alertLogs[0].event_data.metadata.alert_type).toBe('MALICIOUS_COMMAND_SEQUENCE');

    const dbAlerts = await db.querySecurityAlerts();
    expect(dbAlerts.length).toBe(1);
    expect(dbAlerts[0].rule).toBe('MALICIOUS_COMMAND_SEQUENCE');
  });

  // 14. Duplicate/uncontrolled alerts are prevented
  test('14. Duplicate/uncontrolled alerts are prevented', async () => {
    const blocksNeeded = alerts.ALERT_BLOCK_THRESHOLD;
    const session_id = '11111111-2222-3333-4444-555555555555';

    // Trigger first alert
    for (let i = 0; i < blocksNeeded; i++) {
      await request(app)
        .post('/events')
        .send({
          event_type: 'COMMAND_BLOCKED',
          user_id: 12,
          session_id,
          result: 'BLOCKED',
          metadata: { command: 'cat /etc/shadow' }
        });
    }

    // Trigger more blocks (should not produce another alert because of cooldown)
    await request(app)
      .post('/events')
      .send({
        event_type: 'COMMAND_BLOCKED',
        user_id: 12,
        session_id,
        result: 'BLOCKED',
        metadata: { command: 'sudo su' }
      });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify only 1 alert log exists
    const alertLogs = await db.queryAuditLogs({ event_type: 'SECURITY_ALERT' });
    expect(alertLogs.length).toBe(1);
  });

  // 15. /health works
  test('15. /health works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('monitoring');
  });

  // 16. /metrics works
  test('16. /metrics works', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('active_ssh_sessions');
    expect(res.text).toContain('sessions_created_total');
  });

  // 17. Audit event is persisted correctly
  test('17. Audit event is persisted correctly', async () => {
    const event = {
      event_type: 'LOGIN_SUCCESS',
      user_id: 42,
      result: 'SUCCESS',
      metadata: { source: '10.0.0.5' }
    };

    await request(app)
      .post('/events')
      .send(event);

    const logs = await db.queryAuditLogs({ user_id: 42 });
    expect(logs.length).toBe(1);
    expect(logs[0].event_type).toBe('LOGIN_SUCCESS');
    expect(logs[0].user_id).toBe(42);
    expect(logs[0].event_data.result).toBe('SUCCESS');
    expect(logs[0].event_data.metadata.source).toBe('10.0.0.5');
  });
});
