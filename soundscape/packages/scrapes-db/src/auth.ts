import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';

const PASSWORD_KEY_BYTES = 64;
const PASSWORD_SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const PASSWORD_COST = { N: 16_384, r: 8, p: 1 };

function deriveKey(
  password: string,
  salt: string,
  keyLength: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      PASSWORD_COST,
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived as Buffer);
      }
    );
  });
}

export function createToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derived = await deriveKey(password, salt, PASSWORD_KEY_BYTES);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = await deriveKey(password, salt, expected.length);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
