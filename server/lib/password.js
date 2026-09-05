import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Hash a password with scrypt. Format: scrypt$<salt-hex>$<key-hex>
 */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Constant-time verification. Returns false rather than throwing on malformed
 * stored values so a corrupt row can never be used to bypass the check.
 */
export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, keyHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== KEYLEN) return false;

    const actual = scryptSync(password, salt, KEYLEN, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) {
    return 'Password must be 200 characters or fewer.';
  }
  return null;
}
