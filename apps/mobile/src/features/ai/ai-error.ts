import type { ApiErrorCode } from '@fant/api-types';

/** A failure the screens can explain; `code` comes from the server or the network. */
export class AiError extends Error {
  override readonly name = 'AiError';

  constructor(
    readonly code: ApiErrorCode | 'offline',
    message: string,
  ) {
    super(message);
  }
}
