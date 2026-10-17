import { Algorithm, hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

// OWASP-recommended Argon2id parameters (m=19456 KiB, t=2, p=1).
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
