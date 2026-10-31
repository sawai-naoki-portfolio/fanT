import type { ApiErrorCode } from '@fant/api-types';

/** An error the API reports to the app with its code. */
export class ApiFailure extends Error {
  override readonly name = 'ApiFailure';

  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  insufficient_credits: 402,
  rate_limited: 429,
  moderation_blocked: 422,
  timeout: 504,
  unavailable: 503,
  internal: 500,
};
