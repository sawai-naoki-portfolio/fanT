import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Only a hash of each device secret is stored, so a database leak reveals no credential. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function secretMatches(secret: string, storedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Random, unguessable IDs for accounts and generations. */
export function newId(): string {
  return randomBytes(16).toString('hex');
}

/** `Authorization: Bearer <accountId>.<secret>` → its parts, or `null`. */
export function parseBearer(
  header: string | undefined,
): { accountId: string; secret: string } | null {
  const match = /^Bearer ([a-z0-9]{20,40})\.([A-Za-z0-9_-]{43})$/.exec(header ?? '');
  return match?.[1] === undefined || match[2] === undefined
    ? null
    : { accountId: match[1], secret: match[2] };
}

/** Compares shared secrets (e.g. webhook tokens) without leaking timing. */
export function sameSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
