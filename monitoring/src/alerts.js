const db = require('./db');
require('dotenv').config();

// Load Alert Configurations from environment variables with sensible defaults
const ALERT_FAILURE_THRESHOLD = parseInt(process.env.ALERT_FAILURE_THRESHOLD, 10) || 5;
const ALERT_FAILURE_WINDOW_SECONDS = parseInt(process.env.ALERT_FAILURE_WINDOW_SECONDS, 10) || 300; // 5 mins

const ALERT_BLOCK_THRESHOLD = parseInt(process.env.ALERT_BLOCK_THRESHOLD, 10) || 3;
const ALERT_BLOCK_WINDOW_SECONDS = parseInt(process.env.ALERT_BLOCK_WINDOW_SECONDS, 10) || 300; // 5 mins

const ALERT_COOLDOWN_MS = (parseInt(process.env.ALERT_COOLDOWN_SECONDS, 10) || 60) * 1000; // default 60s cooldown

// Track last triggered alert times to prevent alert spam (in-memory caching)
const lastTriggeredAlerts = new Map();

/**
 * Checks if a specific alert type is currently in cooldown.
 * If not in cooldown, updates the last triggered timestamp.
 * @param {string} alertType The alert identifier (e.g. BRUTE_FORCE_BYPASS_ATTEMPT)
 * @param {string|number} userId User ID
 * @param {string} sessionId Session ID
 * @returns {boolean} True if in cooldown (should skip), False otherwise.
 */
function checkAndSetCooldown(alertType, userId, sessionId) {
  const key = `${alertType}:${userId || ''}:${sessionId || ''}`;
  const now = Date.now();
  const lastTime = lastTriggeredAlerts.get(key);

  if (lastTime && now - lastTime < ALERT_COOLDOWN_MS) {
    return true; // Still in cooldown, spam prevented
  }

  lastTriggeredAlerts.set(key, now);
  return false;
}

/**
 * Resets alert thresholds and cooldown state (for unit tests).
 */
function resetAlertState() {
  lastTriggeredAlerts.clear();
}

/**
 * Evaluates security rules on incoming events and triggers alerts if necessary.
 * @param {Object} event The validated event object.
 * @param {Function} triggerAlertCallback Function to call with the generated SECURITY_ALERT event.
 */
async function evaluateAlertRules(event, triggerAlertCallback) {
  const { event_type, user_id, server_id, session_id } = event;

  // RULE A: Repeated authorization failures
  if (event_type === 'LOGIN_FAILURE') {
    const sinceDate = new Date(Date.now() - ALERT_FAILURE_WINDOW_SECONDS * 1000).toISOString();
    try {
      const count = await db.countEventsInWindow('LOGIN_FAILURE', user_id, null, sinceDate);
      if (count >= ALERT_FAILURE_THRESHOLD) {
        // Evaluate spam prevention
        const inCooldown = checkAndSetCooldown('BRUTE_FORCE_BYPASS_ATTEMPT', user_id, null);
        if (!inCooldown) {
          const alertEvent = {
            event_type: 'SECURITY_ALERT',
            user_id,
            server_id,
            session_id,
            result: 'BLOCKED',
            metadata: {
              alert_type: 'BRUTE_FORCE_BYPASS_ATTEMPT',
              source_event_type: 'LOGIN_FAILURE',
              threshold: ALERT_FAILURE_THRESHOLD,
              window: ALERT_FAILURE_WINDOW_SECONDS,
              count
            }
          };

          // Persist in Postgres security_alerts table
          await db.saveSecurityAlert({
            session_id,
            user_id,
            server_id,
            rule: 'BRUTE_FORCE_BYPASS_ATTEMPT',
            severity: 'high',
            description: `User ${user_id || 'unknown'} exceeded ${ALERT_FAILURE_THRESHOLD} login failures within ${ALERT_FAILURE_WINDOW_SECONDS} seconds.`
          });

          await triggerAlertCallback(alertEvent);
        }
      }
    } catch (err) {
      console.error('Error evaluating Rule A (Brute force bypass attempt)', err);
    }
  }

  // RULE B: Repeated blocked commands
  if (event_type === 'COMMAND_BLOCKED') {
    const sinceDate = new Date(Date.now() - ALERT_BLOCK_WINDOW_SECONDS * 1000).toISOString();
    try {
      const count = await db.countEventsInWindow('COMMAND_BLOCKED', user_id, session_id, sinceDate);
      if (count >= ALERT_BLOCK_THRESHOLD) {
        // Evaluate spam prevention
        const inCooldown = checkAndSetCooldown('MALICIOUS_COMMAND_SEQUENCE', user_id, session_id);
        if (!inCooldown) {
          const alertEvent = {
            event_type: 'SECURITY_ALERT',
            user_id,
            server_id,
            session_id,
            result: 'BLOCKED',
            metadata: {
              alert_type: 'MALICIOUS_COMMAND_SEQUENCE',
              source_event_type: 'COMMAND_BLOCKED',
              threshold: ALERT_BLOCK_THRESHOLD,
              window: ALERT_BLOCK_WINDOW_SECONDS,
              count
            }
          };

          // Persist in Postgres security_alerts table
          await db.saveSecurityAlert({
            session_id,
            user_id,
            server_id,
            rule: 'MALICIOUS_COMMAND_SEQUENCE',
            severity: 'critical',
            description: `Session ${session_id || 'unknown'} user ${user_id || 'unknown'} triggered ${ALERT_BLOCK_THRESHOLD} blocked commands within ${ALERT_BLOCK_WINDOW_SECONDS} seconds.`
          });

          await triggerAlertCallback(alertEvent);
        }
      }
    } catch (err) {
      console.error('Error evaluating Rule B (Repeated blocked commands)', err);
    }
  }
}

module.exports = {
  evaluateAlertRules,
  resetAlertState,
  ALERT_FAILURE_THRESHOLD,
  ALERT_FAILURE_WINDOW_SECONDS,
  ALERT_BLOCK_THRESHOLD,
  ALERT_BLOCK_WINDOW_SECONDS
};
