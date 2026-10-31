/**
 * Every analytics event the app sends (ANL-01): anonymous and minimal. No photo,
 * face data, free text or advertising ID is ever included (03 §6).
 */
export type AnalyticsEvent =
  | { readonly name: 'app_open' }
  | { readonly name: 'mode_selected'; readonly mode: string }
  | { readonly name: 'film_selected'; readonly filmId: string }
  | { readonly name: 'photo_taken'; readonly mode: string; readonly filmId: string }
  | { readonly name: 'photo_saved'; readonly kind: string }
  | { readonly name: 'photo_shared'; readonly kind: string; readonly target?: 'stories' }
  | {
      readonly name: 'paywall_shown';
      readonly trigger: string;
      /** The remote config's lead variant shown (ANL-03), if any. */
      readonly leadVariant?: number;
    }
  | { readonly name: 'purchase_completed'; readonly productId: string }
  | { readonly name: 'ai_generated'; readonly styleId: string }
  | { readonly name: 'collage_made'; readonly count: number }
  | { readonly name: 'video_recorded'; readonly filmId: string; readonly seconds: number }
  | {
      readonly name: 'error';
      readonly context: string;
      readonly errorName: string;
      readonly message: string;
      readonly fatal: boolean;
    };

/** Shortens text that could be long (e.g. error messages) before sending. */
export function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Turns anything thrown into a safe error event (ANL-02). */
export function toErrorEvent(error: unknown, context: string, fatal: boolean): AnalyticsEvent {
  const errorName = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  // Strip file paths and URLs, which can contain IDs.
  const scrubbed = message.replace(/(file|content|https?):\/\/\S+/g, '<uri>');
  return { name: 'error', context, errorName, message: truncate(scrubbed), fatal };
}
