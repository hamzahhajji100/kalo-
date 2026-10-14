import { z } from 'zod';

/** Worker bindings / environment variables. Secrets are set with `wrangler secret put`. */
export interface Env {
  ANTHROPIC_API_KEY?: string;
  /** Claude model for vision; defaults to claude-opus-5-5. */
  ANTHROPIC_MODEL?: string;
  /** Effort for vision calls (low keeps latency down). */
  ANTHROPIC_EFFORT?: string;
  TOKEN_SECRET?: string;
  USDA_API_KEY?: string;
  /** Daily per-device limits, e.g. "30". */
  PHOTO_DAILY_LIMIT?: string;
  LABEL_DAILY_LIMIT?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

const Effort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);

export interface Config {
  model: string;
  effort: z.infer<typeof Effort>;
  tokenSecret: string | null;
  usdaApiKey: string | null;
  limits: { photo: number; label: number; usda: number };
  /** Abort Claude calls after this many ms (the app shows a timeout message). */
  claudeTimeoutMs: number;
}

export function readConfig(env: Env): Config {
  const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
  return {
    model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    effort: Effort.catch('low').parse(env.ANTHROPIC_EFFORT ?? 'low'),
    tokenSecret: env.TOKEN_SECRET || null,
    usdaApiKey: env.USDA_API_KEY || null,
    limits: {
      photo: int(env.PHOTO_DAILY_LIMIT, 30),
      label: int(env.LABEL_DAILY_LIMIT, 30),
      usda: 300,
    },
    claudeTimeoutMs: 20_000,
  };
}
