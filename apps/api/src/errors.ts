import type { ApiErrorBody } from '@kalo/schemas';

/** Error with an HTTP status and a stable code the app can translate. */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 422 | 429 | 502 | 503 | 504,
    readonly code: ApiErrorBody['error'],
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }

  body(): ApiErrorBody {
    return {
      error: this.code,
      message: this.message,
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
    };
  }
}
