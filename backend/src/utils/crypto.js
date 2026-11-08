const crypto = require('crypto');

// Derive a deterministic 32-byte (256-bit) AES key from the master secret
function getEncryptionKey() {
  const masterSecret =
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'super_secure_vault_master_key_2026_aes256';

  return crypto.createHash('sha256').update(String(masterSecret), 'utf8').digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM envelope encryption.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 *
 * @param {string} plaintext - Raw credential string
 * @returns {string|null} - Formatted encrypted ciphertext or null
 */
function encryptCredential(plaintext) {
  if (!plaintext || typeof plaintext !== 'string' || plaintext.trim() === '') {
    return null;
  }

  // Idempotency: If already encrypted, return as is
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit nonce for AES-GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag

  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted ciphertext back to plaintext UTF-8.
 * Transparently falls back to raw string for unencrypted legacy credentials.
 *
 * @param {string} encryptedStr - Formatted ciphertext (enc:v1:...) or legacy plaintext
 * @returns {string|null} - Decrypted plaintext string
 */
function decryptCredential(encryptedStr) {
  if (!encryptedStr || typeof encryptedStr !== 'string') {
    return null;
  }

  // Graceful fallback for unencrypted legacy credentials
  if (!isEncrypted(encryptedStr)) {
    return encryptedStr;
  }

  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new Error('Invalid encryption token format');
    }

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const ciphertext = Buffer.from(parts[4], 'hex');

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Failed to decrypt credential:', error.message);
    throw new Error('Cryptographic decryption failed: Invalid token or mismatched master key');
  }
}

/**
 * Checks whether a given string is an AES-256-GCM envelope token.
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('enc:v1:');
}

module.exports = {
  encryptCredential,
  decryptCredential,
  isEncrypted,
};

