const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
let pool = null;
let useMemoryFallback = false;

// In-memory data store for fallback/testing
const inMemoryLogs = [];
const inMemoryAlerts = [];

if (connectionString) {
  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000 // fail fast if db is not up
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  } catch (error) {
    console.warn('Failed to initialize PostgreSQL pool. Falling back to in-memory store.', error.message);
    useMemoryFallback = true;
  }
} else {
  console.log('No DATABASE_URL found in environment. Running with in-memory database fallback.');
  useMemoryFallback = true;
}

/**
 * Initializes database tables if they do not exist.
 * Ensures compatibility with DATABASE_SCHEMA.md.
 */
async function initializeDb() {
  if (useMemoryFallback) {
    return;
  }

  const client = await pool.connect();
  try {
    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        session_id UUID NULL,
        user_id BIGINT NULL,
        server_id BIGINT NULL,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for performance on commonly queried fields
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_server_id ON audit_logs(server_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`);

    // Create security_alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id BIGSERIAL PRIMARY KEY,
        session_id UUID NULL,
        user_id BIGINT NULL,
        server_id BIGINT NULL,
        rule VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_security_alerts_session_id ON security_alerts(session_id);`);

    console.log('PostgreSQL database initialized successfully.');
  } catch (err) {
    console.warn('Database initialization failed. Falling back to in-memory mode.', err.message);
    useMemoryFallback = true;
  } finally {
    client.release();
  }
}

/**
 * Persists an audit event to the database (or in-memory store).
 * @param {Object} event The validated event object.
 */
async function saveAuditEvent(event) {
  const {
    event_id,
    event_type,
    timestamp,
    user_id,
    server_id,
    session_id,
    result,
    metadata
  } = event;

  const eventData = {
    event_id,
    result,
    metadata
  };

  const parsedUserId = user_id ? parseInt(user_id, 10) : null;
  const parsedServerId = server_id ? parseInt(server_id, 10) : null;
  // Ensure session_id matches UUID format, otherwise null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const parsedSessionId = session_id && uuidRegex.test(session_id) ? session_id : null;

  if (useMemoryFallback) {
    const record = {
      id: inMemoryLogs.length + 1,
      session_id: parsedSessionId,
      user_id: parsedUserId,
      server_id: parsedServerId,
      event_type,
      event_data: eventData,
      timestamp: new Date(timestamp)
    };
    inMemoryLogs.push(record);
    return record;
  }

  const query = `
    INSERT INTO audit_logs (session_id, user_id, server_id, event_type, event_data, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [
    parsedSessionId,
    parsedUserId,
    parsedServerId,
    event_type,
    JSON.stringify(eventData),
    new Date(timestamp)
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

/**
 * Persists a security alert.
 * @param {Object} alert The alert details.
 */
async function saveSecurityAlert(alert) {
  const {
    session_id,
    user_id,
    server_id,
    rule,
    severity,
    description,
    status = 'open',
    created_at = new Date().toISOString()
  } = alert;

  const parsedUserId = user_id ? parseInt(user_id, 10) : null;
  const parsedServerId = server_id ? parseInt(server_id, 10) : null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const parsedSessionId = session_id && uuidRegex.test(session_id) ? session_id : null;

  if (useMemoryFallback) {
    const record = {
      id: inMemoryAlerts.length + 1,
      session_id: parsedSessionId,
      user_id: parsedUserId,
      server_id: parsedServerId,
      rule,
      severity,
      description,
      status,
      created_at: new Date(created_at)
    };
    inMemoryAlerts.push(record);
    return record;
  }

  const query = `
    INSERT INTO security_alerts (session_id, user_id, server_id, rule, severity, description, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [
    parsedSessionId,
    parsedUserId,
    parsedServerId,
    rule,
    severity,
    description,
    status,
    new Date(created_at)
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

/**
 * Queries audit logs with pagination and filters.
 */
async function queryAuditLogs(filters = {}) {
  const {
    event_type,
    user_id,
    server_id,
    session_id,
    result,
    from,
    to,
    limit = 50,
    offset = 0
  } = filters;

  if (useMemoryFallback) {
    // Implement standard filtering logic over in-memory list
    let filtered = [...inMemoryLogs];

    if (event_type) {
      filtered = filtered.filter(log => log.event_type === event_type);
    }
    if (user_id) {
      filtered = filtered.filter(log => log.user_id === parseInt(user_id, 10));
    }
    if (server_id) {
      filtered = filtered.filter(log => log.server_id === parseInt(server_id, 10));
    }
    if (session_id) {
      filtered = filtered.filter(log => log.session_id === session_id);
    }
    if (result) {
      filtered = filtered.filter(log => log.event_data && log.event_data.result === result);
    }
    if (from) {
      const fromTime = new Date(from).getTime();
      filtered = filtered.filter(log => log.timestamp.getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(to).getTime();
      filtered = filtered.filter(log => log.timestamp.getTime() <= toTime);
    }

    // Sort descending by timestamp
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    return filtered.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));
  }

  // Build parameterized PostgreSQL query
  let queryText = 'SELECT * FROM audit_logs';
  const conditions = [];
  const values = [];

  if (event_type) {
    values.push(event_type);
    conditions.push(`event_type = $${values.length}`);
  }
  if (user_id) {
    values.push(parseInt(user_id, 10));
    conditions.push(`user_id = $${values.length}`);
  }
  if (server_id) {
    values.push(parseInt(server_id, 10));
    conditions.push(`server_id = $${values.length}`);
  }
  if (session_id) {
    values.push(session_id);
    conditions.push(`session_id = $${values.length}`);
  }
  if (result) {
    values.push(result);
    conditions.push(`event_data->>'result' = $${values.length}`);
  }
  if (from) {
    values.push(new Date(from));
    conditions.push(`timestamp >= $${values.length}`);
  }
  if (to) {
    values.push(new Date(to));
    conditions.push(`timestamp <= $${values.length}`);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }

  // Sort and paginate
  queryText += ' ORDER BY timestamp DESC';
  values.push(parseInt(limit, 10));
  queryText += ` LIMIT $${values.length}`;
  values.push(parseInt(offset, 10));
  queryText += ` OFFSET $${values.length}`;

  const res = await pool.query(queryText, values);
  return res.rows;
}

/**
 * Counts events of specific type within a sliding time window for security rules.
 */
async function countEventsInWindow(eventType, userId, sessionId, sinceDate) {
  if (useMemoryFallback) {
    const sinceTime = new Date(sinceDate).getTime();
    return inMemoryLogs.filter(log => {
      if (log.event_type !== eventType) return false;
      if (log.timestamp.getTime() < sinceTime) return false;
      if (userId && log.user_id !== parseInt(userId, 10)) return false;
      if (sessionId && log.session_id !== sessionId) return false;
      return true;
    }).length;
  }

  let query = 'SELECT COUNT(*)::int FROM audit_logs WHERE event_type = $1 AND timestamp >= $2';
  const values = [eventType, new Date(sinceDate)];

  if (userId) {
    values.push(parseInt(userId, 10));
    query += ` AND user_id = $${values.length}`;
  }
  if (sessionId) {
    values.push(sessionId);
    query += ` AND session_id = $${values.length}`;
  }

  const res = await pool.query(query, values);
  return res.rows[0].count;
}

/**
 * Queries security alerts (for demonstration/dashboard).
 */
async function querySecurityAlerts() {
  if (useMemoryFallback) {
    return [...inMemoryAlerts].sort((a, b) => b.created_at - a.created_at);
  }
  const res = await pool.query('SELECT * FROM security_alerts ORDER BY created_at DESC');
  return res.rows;
}

/**
 * Resets database states (useful for unit testing).
 */
function resetDbState() {
  inMemoryLogs.length = 0;
  inMemoryAlerts.length = 0;
}

/**
 * Clean up connections on shutdown.
 */
async function closeDb() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  initializeDb,
  saveAuditEvent,
  saveSecurityAlert,
  queryAuditLogs,
  countEventsInWindow,
  querySecurityAlerts,
  resetDbState,
  closeDb,
  isMemoryFallback: () => useMemoryFallback
};
