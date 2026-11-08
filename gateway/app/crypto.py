import hashlib
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings


def get_encryption_key() -> bytes:
    """
    Derives a deterministic 32-byte (256-bit) AES key from the master vault secret.
    """
    master_key = settings.credential_encryption_key or "super_secure_vault_master_key_2026_aes256"
    return hashlib.sha256(master_key.encode("utf-8")).digest()


def decrypt_credential(encrypted_str: Optional[str]) -> Optional[str]:
    """
    Decrypts an AES-256-GCM envelope ciphertext on-the-fly in transient memory.
    Format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>

    Returns the decrypted plaintext, or the original string if not encrypted (legacy fallback).
    """
    if not encrypted_str or not isinstance(encrypted_str, str):
        return None

    # Transparent fallback for unencrypted legacy credentials
    if not is_encrypted(encrypted_str):
        return encrypted_str

    try:
        parts = encrypted_str.split(":")
        if len(parts) != 5 or parts[0] != "enc" or parts[1] != "v1":
            raise ValueError(f"Invalid envelope encryption format: {encrypted_str[:15]}...")

        iv = bytes.fromhex(parts[2])
        tag = bytes.fromhex(parts[3])
        ciphertext = bytes.fromhex(parts[4])

        aesgcm = AESGCM(get_encryption_key())
        # In AESGCM.decrypt, data is expected to be ciphertext concatenated with the 16-byte tag
        payload = ciphertext + tag
        decrypted_bytes = aesgcm.decrypt(iv, payload, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as exc:
        print(f"[SECURITY ALERT] Failed to decrypt target credential: {exc}")
        raise ValueError("Decryption failed: Token is corrupt or master key mismatch") from exc


def encrypt_credential(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypts a plaintext string into an AES-256-GCM envelope token.
    Format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
    """
    if not plaintext or not isinstance(plaintext, str):
        return None

    if is_encrypted(plaintext):
        return plaintext

    aesgcm = AESGCM(get_encryption_key())
    iv = os.urandom(12)  # Standard 96-bit nonce
    combined = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)

    # In cryptography, combined output has the 16-byte tag at the end
    ciphertext = combined[:-16]
    tag = combined[-16:]

    return f"enc:v1:{iv.hex()}:{tag.hex()}:{ciphertext.hex()}"


def is_encrypted(value: Optional[str]) -> bool:
    """Checks whether a string is an AES-256-GCM envelope token."""
    return isinstance(value, str) and value.startswith("enc:v1:")

