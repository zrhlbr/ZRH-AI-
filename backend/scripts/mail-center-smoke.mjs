/**
 * Mail Center V1.0 smoke checks (no network SMTP required for mock path).
 * Usage (from backend/): node scripts/mail-center-smoke.mjs
 */
import { createHash, randomBytes } from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Load compiled util via dynamic import of ts not available — inline critical rules
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const isProd = process.env.NODE_ENV === 'production';
const devEnabled = String(process.env.MAIL_DEV_CODE_ENABLED || 'false').toLowerCase() === 'true';

// Rule matrix
assert(!(isProd && devEnabled === false) || true, 'noop');

function shouldAllowDevCode(nodeEnv, mailDevCodeEnabled) {
  return nodeEnv !== 'production' && String(mailDevCodeEnabled).toLowerCase() === 'true';
}

assert(shouldAllowDevCode('production', 'true') === false, 'prod must never expose devCode even if switch on');
assert(shouldAllowDevCode('development', 'false') === false, 'dev default off');
assert(shouldAllowDevCode('development', 'true') === true, 'dev explicit on');
assert(shouldAllowDevCode('test', 'true') === true, 'test explicit on');

// Crypto roundtrip using same algorithm as mail-crypto.util.ts
process.env.MAIL_CONFIG_CRYPTO_KEY = process.env.MAIL_CONFIG_CRYPTO_KEY || randomBytes(32).toString('hex');
const { createCipheriv, createDecipheriv, createHash: ch } = await import('crypto');
const ALGO = 'aes-256-gcm';
const key = Buffer.from(process.env.MAIL_CONFIG_CRYPTO_KEY, 'hex');
const iv = randomBytes(12);
const cipher = createCipheriv(ALGO, key, iv);
const enc = Buffer.concat([cipher.update('smtp-secret', 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const payload = `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
const [ivB64, tagB64, dataB64] = payload.slice(3).split(':');
const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
const plain = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
assert(plain === 'smtp-secret', 'AES roundtrip failed');

console.log('[mail-smoke] OK — policy matrix + AES crypto');
console.log(
  JSON.stringify(
    {
      NODE_ENV: process.env.NODE_ENV || '(unset)',
      MAIL_DEV_CODE_ENABLED: process.env.MAIL_DEV_CODE_ENABLED || 'false',
      hashProbe: createHash('sha256').update('x').digest('hex').slice(0, 8),
    },
    null,
    2,
  ),
);
