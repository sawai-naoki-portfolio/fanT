import { describe, expect, it } from 'vitest';

import { clientAddress } from '../src/http/client-address';

describe('clientAddress', () => {
  it('trusts only the address the front end appended', () => {
    expect(clientAddress('1.1.1.1, 203.0.113.7', '1.1.1.1')).toBe('203.0.113.7');
    expect(clientAddress('203.0.113.7', undefined)).toBe('203.0.113.7');
  });

  it('falls back without the header', () => {
    expect(clientAddress(undefined, '203.0.113.7')).toBe('203.0.113.7');
    expect(clientAddress(' ', undefined)).toBe('unknown');
  });
});
