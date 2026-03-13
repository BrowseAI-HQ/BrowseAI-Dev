import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const API_KEY_PREFIX = "bai_";
const API_KEY_RANDOM_BYTES = 16; // 16 bytes = 32 hex chars

/**
 * Generate a new BrowseAI Dev API key: bai_ + 32 random hex chars.
 * Returns the plaintext (shown once), SHA-256 hash (stored), and prefix (for display).
 */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = randomBytes(API_KEY_RANDOM_BYTES).toString("hex");
  const plaintext = `${API_KEY_PREFIX}${random}`;
  const hash = hashApiKey(plaintext);
  const prefix = plaintext.slice(0, 8);
  return { plaintext, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function isBrowseApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length === API_KEY_PREFIX.length + API_KEY_RANDOM_BYTES * 2;
}

export function encryptValue(
  plaintext: string,
  encryptionKeyHex: string
): { ciphertext: string; iv: string } {
  const key = Buffer.from(encryptionKeyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return {
    ciphertext: `${encrypted}.${authTag}`,
    iv: iv.toString("base64"),
  };
}

export function decryptValue(
  ciphertextWithTag: string,
  ivBase64: string,
  encryptionKeyHex: string
): string {
  const key = Buffer.from(encryptionKeyHex, "hex");
  const iv = Buffer.from(ivBase64, "base64");
  const [ciphertext, authTagBase64] = ciphertextWithTag.split(".");
  const authTag = Buffer.from(authTagBase64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
