import { randomBytes, randomUUID as nodeRandomUUID } from 'node:crypto';

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(randomBytes(byteCount));
}

export function randomUUID(): string {
  return nodeRandomUUID();
}
