import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_SALT = "chartfm-social-token-v1";

function resolveEncryptionKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY não configurada");
  }

  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === KEY_LENGTH) {
    return fromBase64;
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return scryptSync(raw, SCRYPT_SALT, KEY_LENGTH);
}

export function hasEncryptionKey(): boolean {
  return Boolean(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim());
}

export function encryptToken(plaintext: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = resolveEncryptionKey();
  const data = Buffer.from(ciphertext, "base64");
  if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Token criptografado inválido");
  }

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
