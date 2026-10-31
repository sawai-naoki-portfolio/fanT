import type { EventsRequest } from '@fant/api-types';

import type { Dependencies } from '../ports';
import { takeAddressRate } from './address-limit';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Records a batch of anonymous analytics events (ANL-01). Cloud Logging is exported
 * to BigQuery for analysis; nothing else stores them. Limited per network address,
 * since the endpoint needs no account and every event costs log storage.
 */
export async function recordEvents(
  deps: Dependencies,
  batch: EventsRequest,
  address: string,
): Promise<void> {
  await deps.store.transaction((tx) =>
    takeAddressRate(tx, 'events', address, {
      count: deps.settings.eventBatchesPerAddressPerHour,
      windowMs: HOUR_MS,
      now: deps.now(),
    }),
  );
  for (const { event, at } of batch.events) {
    deps.logger.info('analytics.event', {
      ...event,
      at,
      installId: batch.installId,
      platform: batch.platform,
      appVersion: batch.appVersion,
    });
  }
}
