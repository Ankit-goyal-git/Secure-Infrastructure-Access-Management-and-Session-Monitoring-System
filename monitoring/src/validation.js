const { v4: uuidv4 } = require('uuid');

const SUPPORTED_EVENT_TYPES = new Set([
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'ACCESS_REQUESTED',
  'ACCESS_APPROVED',
  'ACCESS_REJECTED',
  'SESSION_CREATED',
  'SESSION_ENDED',
  'COMMAND_ALLOWED',
  'COMMAND_BLOCKED',
  'ACCESS_EXPIRED',
  'SECURITY_ALERT'
]);

const SUPPORTED_RESULTS = new Set([
  'ALLOWED',
  'BLOCKED',
  'SUCCESS',
  'FAILURE',
  'EXPIRED'
]);

/**
 * Validates and normalizes an incoming audit event.
 * Modifies the event by generating missing event_id and timestamp if they are omitted.
 * @param {Object} event The raw event object.
 * @returns {{isValid: boolean, errors?: string[], event?: Object}} Validation result.
 */
function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    return { isValid: false, errors: ['Event must be a valid JSON object'] };
  }

  const errors = [];
  const normalized = { ...event };

  // Validate or generate event_id
  if (!normalized.event_id) {
    normalized.event_id = uuidv4();
  } else if (typeof normalized.event_id !== 'string') {
    errors.push('event_id must be a string');
  }

  // Validate or generate timestamp
  if (!normalized.timestamp) {
    normalized.timestamp = new Date().toISOString();
  } else {
    const timestampMs = Date.parse(normalized.timestamp);
    if (isNaN(timestampMs)) {
      errors.push('timestamp must be a valid ISO 8601 UTC date string');
    } else {
      // Ensure ISO format / UTC
      normalized.timestamp = new Date(timestampMs).toISOString();
    }
  }

  // Validate event_type
  if (!normalized.event_type) {
    errors.push('event_type is required');
  } else if (!SUPPORTED_EVENT_TYPES.has(normalized.event_type)) {
    errors.push(`Unsupported event_type: ${normalized.event_type}`);
  }

  // Validate result (optional, but if present, must be supported)
  if (normalized.result !== undefined && normalized.result !== null) {
    if (!SUPPORTED_RESULTS.has(normalized.result)) {
      errors.push(`Unsupported result: ${normalized.result}`);
    }
  }

  // Validate user_id, server_id, session_id types if present
  if (normalized.user_id !== undefined && normalized.user_id !== null) {
    const type = typeof normalized.user_id;
    if (type !== 'string' && type !== 'number') {
      errors.push('user_id must be a string or a number');
    }
  }

  if (normalized.server_id !== undefined && normalized.server_id !== null) {
    const type = typeof normalized.server_id;
    if (type !== 'string' && type !== 'number') {
      errors.push('server_id must be a string or a number');
    }
  }

  if (normalized.session_id !== undefined && normalized.session_id !== null) {
    if (typeof normalized.session_id !== 'string') {
      errors.push('session_id must be a string');
    }
  }

  // Validate metadata is an object if present
  if (normalized.metadata !== undefined && normalized.metadata !== null) {
    if (typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
      errors.push('metadata must be a JSON object');
    }
  } else {
    normalized.metadata = {};
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, event: normalized };
}

module.exports = {
  validateEvent,
  SUPPORTED_EVENT_TYPES,
  SUPPORTED_RESULTS
};
