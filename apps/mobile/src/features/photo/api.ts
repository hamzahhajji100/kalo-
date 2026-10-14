import { ApiErrorBody, LabelReading, PhotoAnalysis, type ImageRequest } from '@kalo/schemas';
import type { z } from 'zod';

import { apiHeaders, clearApiToken } from '@/lib/api';
import { config } from '@/lib/config';
import { HttpError, requestJson } from '@/lib/http';

export type AiErrorKind =
  'not_configured' | 'offline' | 'timeout' | 'rate_limited' | 'refused' | 'server';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    /** Seconds until the limit resets (rate_limited). */
    readonly retryAfter?: number,
  ) {
    super(kind);
    this.name = 'AiError';
  }
}

/** Translate transport errors and the API's error codes into what the UI distinguishes. */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof HttpError) {
    const body = ApiErrorBody.safeParse(e.body);
    const code = body.success ? body.data.error : undefined;
    if (code === 'refused') return new AiError('refused');
    if (code === 'not_configured') return new AiError('not_configured');
    if (code === 'upstream_timeout' || e.kind === 'timeout') return new AiError('timeout');
    if (e.kind === 'rate_limited') return new AiError('rate_limited', e.retryAfter);
    if (e.kind === 'offline') return new AiError('offline');
  }
  return new AiError('server');
}

async function post<T>(
  path: string,
  body: ImageRequest,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!config.apiUrl) throw new AiError('not_configured');
  const send = async () =>
    requestJson(`${config.apiUrl}${path}`, {
      schema,
      method: 'POST',
      body,
      headers: await apiHeaders(),
      timeoutMs: 25_000,
      retries: 1,
      ...(signal && { signal }),
    });
  try {
    return await send();
  } catch (e) {
    // Expired/rotated token: fetch a new one once.
    if (e instanceof HttpError && e.status === 401) {
      clearApiToken();
      try {
        return await send();
      } catch (e2) {
        throw toAiError(e2);
      }
    }
    throw toAiError(e);
  }
}

export const analyzeMealPhoto = (req: ImageRequest, signal?: AbortSignal) =>
  post('/v1/analyze-photo', req, PhotoAnalysis, signal);
export const readNutritionLabel = (req: ImageRequest, signal?: AbortSignal) =>
  post('/v1/read-label', req, LabelReading, signal);
