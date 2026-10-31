import { describe, expect, it } from 'vitest';

import {
  accountSecretSchema,
  createGenerationRequestSchema,
  eventsRequestSchema,
  generationSchema,
} from './index';

describe('api schemas', () => {
  it('accepts a 256-bit base64url secret only', () => {
    expect(accountSecretSchema.safeParse('A'.repeat(43)).success).toBe(true);
    expect(accountSecretSchema.safeParse('A'.repeat(42)).success).toBe(false);
    expect(accountSecretSchema.safeParse(`${'A'.repeat(42)}/`).success).toBe(false);
  });

  it('validates generation requests', () => {
    expect(
      createGenerationRequestSchema.safeParse({ styleId: 'figure', image: 'abcd' }).success,
    ).toBe(true);
    expect(
      createGenerationRequestSchema.safeParse({ styleId: '../x', image: 'abcd' }).success,
    ).toBe(false);
    expect(
      createGenerationRequestSchema.safeParse({ styleId: 'figure', image: 'not base64!' }).success,
    ).toBe(false);
    expect(
      createGenerationRequestSchema.safeParse({ styleId: 'figure', image: 'abcd', extra: 1 })
        .success,
    ).toBe(false);
  });

  it('only accepts https result links', () => {
    const generation = {
      id: 'g1',
      status: 'succeeded',
      imageUrl: 'http://example.com/a.jpg',
      error: null,
      credits: { total: 1, monthly: 0, purchased: 1 },
    };
    expect(generationSchema.safeParse(generation).success).toBe(false);
    expect(
      generationSchema.safeParse({ ...generation, imageUrl: 'https://example.com/a.jpg' }).success,
    ).toBe(true);
  });

  it('caps analytics batches', () => {
    const batch = {
      installId: '0b5e3f9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      platform: 'ios',
      appVersion: '0.1.0',
      events: Array.from({ length: 51 }, () => ({ event: { name: 'app_open' }, at: 1 })),
    };
    expect(eventsRequestSchema.safeParse(batch).success).toBe(false);
    expect(
      eventsRequestSchema.safeParse({ ...batch, events: batch.events.slice(0, 50) }).success,
    ).toBe(true);
  });
});
