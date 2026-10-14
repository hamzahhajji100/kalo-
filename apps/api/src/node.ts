/**
 * Local development server (Node). Reads the same variables as the Worker from process.env:
 *   ANTHROPIC_API_KEY=... TOKEN_SECRET=dev pnpm --filter @kalo/api dev:node
 * Counters are in memory.
 */
import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';

import { createApp } from './app';
import { readConfig, type Env } from './config';
import { MemoryCounterStore } from './rateLimit';

const env = process.env as Env;
const app = createApp({
  config: readConfig(env),
  claude: env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null,
  counters: new MemoryCounterStore(),
});
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.warn(`Kalo API listening on http://localhost:${port}`);
