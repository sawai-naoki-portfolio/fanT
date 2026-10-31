import { describe, expect, it } from 'vitest';

import { parseExtra } from './config-schema';

const UNSET = {
  appVariant: 'development',
  contentBaseUrl: null,
  apiBaseUrl: null,
  revenueCatApiKey: { ios: null, android: null },
  supportEmail: null,
  facebookAppId: null,
};

describe('parseExtra', () => {
  it('reads unset values as null, however the native side hands them over', () => {
    expect(parseExtra(UNSET).apiBaseUrl).toBeNull();
    // An iOS release build turns null into an empty object (it crashed at launch).
    const bridged = { ...UNSET, apiBaseUrl: {}, revenueCatApiKey: { ios: {}, android: {} } };
    expect(parseExtra(bridged)).toMatchObject({
      apiBaseUrl: null,
      revenueCatApiKey: { ios: null },
    });
    expect(parseExtra({ appVariant: 'production', revenueCatApiKey: {} }).supportEmail).toBeNull();
  });

  it('still rejects invalid values', () => {
    expect(() => parseExtra({ ...UNSET, apiBaseUrl: 'http://example.com' })).toThrow();
    expect(() => parseExtra({ ...UNSET, facebookAppId: 'abc' })).toThrow();
    expect(parseExtra({ ...UNSET, apiBaseUrl: 'https://api.example.com' }).apiBaseUrl).toBe(
      'https://api.example.com',
    );
  });
});
