const express = require('express');
const cors = require('cors');
const { validateEvent } = require('./validation');
const db = require('./db');
const { updateMetrics, register } = require('./metrics');
const { evaluateAlertRules } = require('./alerts');
require('dotenv').config();

const app = express();
const PORT = process.env.MONITORING_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Structured Logger utility
function logInfo(message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message,
    ...details
  }));
}

function logError(message, err, details = {}) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    ...details
  }));
}

// Ingestion Pipeline Helper
async function processAndIngestEvent(rawEvent) {
  // 1. Validate incoming event
  const validation = validateEvent(rawEvent);
  if (!validation.isValid) {
    throw new Error(`Validation Error: ${validation.errors.join(', ')}`);
  }

  const normalizedEvent = validation.event;

  // 2. Persist audit event
  const savedRecord = await db.saveAuditEvent(normalizedEvent);

  // 3. Update prometheus metrics
  updateMetrics(normalizedEvent);

  logInfo('Audit event processed and saved', {
    event_type: normalizedEvent.event_type,
    event_id: normalizedEvent.event_id,
    session_id: normalizedEvent.session_id,
    user_id: normalizedEvent.user_id,
    result: normalizedEvent.result
  });

  // 4. Evaluate alert rules (only for non-alert events to avoid infinite recursion)
  if (normalizedEvent.event_type !== 'SECURITY_ALERT') {
    // Pass processAndIngestEvent as the callback so triggered alerts go through the same pipeline
    evaluateAlertRules(normalizedEvent, async (alertEvent) => {
      try {
        logInfo('Security Alert Triggered', {
          alert_type: alertEvent.metadata.alert_type,
          user_id: alertEvent.user_id,
          session_id: alertEvent.session_id
        });
        await processAndIngestEvent(alertEvent);
      } catch (err) {
        logError('Failed to process triggered security alert event', err);
      }
    }).catch(err => {
      logError('Error evaluating alert rules', err);
    });
  }

  return savedRecord;
}

// Routes

/**
 * GET /health
 * Simple health status endpoint.
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'monitoring',
    timestamp: new Date().toISOString(),
    databaseFallback: db.isMemoryFallback()
  });
});

/**
 * GET /metrics
 * Exposes Prometheus metrics registry.
 */
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logError('Error rendering metrics', err);
    res.status(500).send(err.message);
  }
});

/**
 * POST /events
 * Receives an audit event from the backend or SSH gateway.
 */
app.post('/events', async (req, res) => {
  try {
    const rawEvent = req.body;
    const savedRecord = await processAndIngestEvent(rawEvent);
    res.status(201).json({
      success: true,
      message: 'Event recorded successfully',
      event_id: savedRecord.event_data.event_id
    });
  } catch (err) {
    if (err.message.startsWith('Validation Error:')) {
      logInfo('Invalid audit event rejected', { error: err.message });
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    logError('Database insertion failed', err);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
});

/**
 * GET /events
 * Retrieves events with pagination and filtering.
 */
app.get('/events', async (req, res) => {
  try {
    const filters = {
      event_type: req.query.event_type,
      user_id: req.query.user_id,
      server_id: req.query.server_id,
      session_id: req.query.session_id,
      result: req.query.result,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0
    };

    const records = await db.queryAuditLogs(filters);
    res.status(200).json(records);
  } catch (err) {
    logError('Failed to query events', err);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
});

/**
 * GET /security-alerts
 * Retrieves triggered security alerts.
 */
app.get('/security-alerts', async (req, res) => {
  try {
    const alerts = await db.querySecurityAlerts();
    res.status(200).json(alerts);
  } catch (err) {
    logError('Failed to query security alerts', err);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
});

// Server Initialization
if (process.env.NODE_ENV !== 'test') {
  db.initializeDb()
    .then(() => {
      app.listen(PORT, () => {
        logInfo(`Monitoring Service listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      logError('Failed to initialize database. Exiting...', err);
      process.exit(1);
    });
}

module.exports = app;
