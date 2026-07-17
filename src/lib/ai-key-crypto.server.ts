// AES-256-GCM wrapper for encrypting BYO Anthropic API keys at rest.
// Uses BYOK_ENCRYPTION_KEY (64 hex chars = 32 bytes) provisioned as a secret.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function key(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (!raw) throw new Error("BYOK_ENCRYPTION_KEY is not set");
  // Accept hex, base64, or raw string — normalize to 32 bytes via SHA-256.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {
    // not valid base64 — fall through to hashing the raw value
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptApiKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
