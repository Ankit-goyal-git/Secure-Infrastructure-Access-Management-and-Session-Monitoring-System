const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add standard process/system metrics
client.collectDefaultMetrics({ register });

// Define Metrics
const activeSessionsGauge = new client.Gauge({
  name: 'active_ssh_sessions',
  help: 'The total count of simultaneous SSH tunnels currently active through the gateway.'
});

const sessionsCreatedCounter = new client.Counter({
  name: 'sessions_created_total',
  help: 'Total volume of SSH session channels initiated.'
});

const sessionsEndedCounter = new client.Counter({
  name: 'sessions_ended_total',
  help: 'Total volume of SSH session channels closed.'
});

const blockedActionsCounter = new client.Counter({
  name: 'blocked_actions_total',
  help: 'Total volume of prohibited command attempts intercepted by the SSH gateway.'
});

const authorizationFailuresCounter = new client.Counter({
  name: 'authorization_failures_total',
  help: 'Total volume of connection handshakes rejected due to expired or missing grants.'
});

const auditEventsCounter = new client.Counter({
  name: 'audit_events_total',
  help: 'Total number of audit events ingested by the system.',
  labelNames: ['event_type', 'result']
});

const securityAlertsCounter = new client.Counter({
  name: 'security_alerts_total',
  help: 'Total number of security alerts generated.',
  labelNames: ['alert_type']
});

const commandAllowedCounter = new client.Counter({
  name: 'command_allowed_total',
  help: 'Total number of successfully permitted commands.'
});

// Register metrics
register.registerMetric(activeSessionsGauge);
register.registerMetric(sessionsCreatedCounter);
register.registerMetric(sessionsEndedCounter);
register.registerMetric(blockedActionsCounter);
register.registerMetric(authorizationFailuresCounter);
register.registerMetric(auditEventsCounter);
register.registerMetric(securityAlertsCounter);
register.registerMetric(commandAllowedCounter);

// In-memory set to prevent double decrement and ensure active session tracking safety
const activeSessionIds = new Set();

/**
 * Updates metrics based on incoming event data.
 * @param {Object} event The validated audit event object.
 */
function updateMetrics(event) {
  const { event_type, result, session_id } = event;

  // Increment total event ingestion count with labels
  auditEventsCounter.inc({
    event_type: event_type || 'UNKNOWN',
    result: result || 'UNKNOWN'
  });

  // Track session lifecycle
  if (event_type === 'SESSION_CREATED') {
    sessionsCreatedCounter.inc();
    if (session_id) {
      if (!activeSessionIds.has(session_id)) {
        activeSessionIds.add(session_id);
        activeSessionsGauge.inc();
      }
    } else {
      // If no session_id is provided, increment anyway
      activeSessionsGauge.inc();
    }
  } else if (event_type === 'SESSION_ENDED') {
    sessionsEndedCounter.inc();
    if (session_id) {
      if (activeSessionIds.has(session_id)) {
        activeSessionIds.delete(session_id);
        activeSessionsGauge.dec();
      }
    } else {
      // Fallback: decrement if gauge is above zero
      activeSessionsGauge.dec();
    }
  } else if (event_type === 'ACCESS_EXPIRED') {
    // If access expired, treat it like a session termination if it was active
    if (session_id && activeSessionIds.has(session_id)) {
      activeSessionIds.delete(session_id);
      activeSessionsGauge.dec();
      sessionsEndedCounter.inc();
    }
  }

  // Ensure active sessions gauge never goes negative
  // If the gauge value drops below zero, reset it to zero
  activeSessionsGauge.get().then((val) => {
    if (val && val.values && val.values[0] && val.values[0].value < 0) {
      activeSessionsGauge.set(0);
    }
  }).catch(() => {});

  // Track blocked commands
  if (event_type === 'COMMAND_BLOCKED') {
    blockedActionsCounter.inc();
  }

  // Track allowed commands
  if (event_type === 'COMMAND_ALLOWED') {
    commandAllowedCounter.inc();
  }

  // Track authorization failures
  if (event_type === 'LOGIN_FAILURE' || result === 'FAILURE') {
    authorizationFailuresCounter.inc();
  }

  // Track security alerts
  if (event_type === 'SECURITY_ALERT') {
    const alertType = (event.metadata && event.metadata.alert_type) || 'UNKNOWN';
    securityAlertsCounter.inc({ alert_type: alertType });
  }
}

/**
 * Gets the current active session count.
 * @returns {number} The size of activeSessionIds set.
 */
function getActiveSessionCount() {
  return activeSessionIds.size;
}

/**
 * Resets active sessions tracking (useful for unit tests).
 */
function resetActiveSessions() {
  activeSessionIds.clear();
  activeSessionsGauge.set(0);
  sessionsCreatedCounter.reset();
  sessionsEndedCounter.reset();
  blockedActionsCounter.reset();
  authorizationFailuresCounter.reset();
  auditEventsCounter.reset();
  securityAlertsCounter.reset();
  commandAllowedCounter.reset();
}

module.exports = {
  register,
  updateMetrics,
  getActiveSessionCount,
  resetActiveSessions,
  activeSessionsGauge
};
