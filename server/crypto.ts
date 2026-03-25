import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = "enc:";

function getKey(envKey: string | undefined): Buffer | null {
  if (!envKey) return null;
  const s = envKey.trim();
  if (s.length >= 32 && s.length <= 64 && /^[A-Za-z0-9+/=]+$/.test(s)) {
    try {
      const buf = Buffer.from(s, "base64");
      if (buf.length === KEY_LENGTH) return buf;
    } catch {
      // not base64, use hash
    }
  }
  return crypto.createHash("sha256").update(s, "utf8").digest();
}

export function encrypt(plaintext: string | null, secret?: string): string | null {
  if (plaintext === null || plaintext === "") return null;
  const key = getKey(secret ?? process.env.ENCRYPTION_KEY);
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, enc]);
  return PREFIX + combined.toString("base64");
}

export function decrypt(ciphertext: string | null, secret?: string): string | null {
  if (ciphertext === null || ciphertext === "") return null;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const key = getKey(secret ?? process.env.ENCRYPTION_KEY);
  if (!key) return ciphertext;

  try {
    const raw = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const enc = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(enc) + decipher.final("utf8");
  } catch {
    return ciphertext;
  }
}
