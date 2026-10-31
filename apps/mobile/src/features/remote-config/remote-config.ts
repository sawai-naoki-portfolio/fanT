import { APP_CONFIG } from '../../config';
import { localized } from '../../i18n';
import { getInstallId } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { bucketOf } from './bucket';

/**
 * Whether AI generation is offered: the server is configured and the remote
 * config has not switched it off (ANL-03), e.g. during a provider outage.
 */
export function useAiAvailable(): boolean {
  const enabled = useContent((state) => state.manifest.config?.features?.ai ?? true);
  return APP_CONFIG.apiBaseUrl !== null && enabled;
}

/** The paywall lead from the remote config, if any, and which A/B variant it is. */
export function usePaywallLead(): { readonly text: string; readonly variant: number } | null {
  const variants = useContent((state) => state.manifest.config?.paywallLead);
  if (variants === undefined) return null;
  const variant = bucketOf(`${getInstallId()}|paywallLead`, variants.length);
  const lead = variants[variant];
  return lead === undefined ? null : { text: localized(lead), variant };
}
