import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1:';

function keyBytes(): Buffer {
  const raw = process.env.MAIL_CONFIG_CRYPTO_KEY || '';
  if (!raw) {
    throw new Error('MAIL_CONFIG_CRYPTO_KEY is required to encrypt/decrypt SMTP password');
  }
  // Accept 64-hex or any passphrase → SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(PREFIX)) {
    throw new Error('unsupported secret payload');
  }
  const body = payload.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('malformed secret payload');
  const decipher = createDecipheriv(ALGO, keyBytes(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

export function isEncryptedSecret(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function maskEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at <= 0) return '***';
  const user = e.slice(0, at);
  const domain = e.slice(at + 1);
  const u = user.length <= 1 ? '*' : `${user[0]}***`;
  return `${u}@${domain}`;
}

export function sanitizeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/pass(word)?[=:]\s*\S+/gi, 'password=***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/\b\d{4,8}\b/g, '****')
    .slice(0, 500);
}
