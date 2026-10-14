import Anthropic from '@anthropic-ai/sdk';

import { createApp } from './app';
import { readConfig, type Env } from './config';
import { KvCounterStore, MemoryCounterStore } from './rateLimit';

/** Cloudflare Workers entry. The app is built once per isolate. */
let app: ReturnType<typeof createApp> | null = null;

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    app ??= createApp({
      config: readConfig(env),
      claude: env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null,
      counters: env.RATE_LIMIT_KV
        ? new KvCounterStore(env.RATE_LIMIT_KV)
        : new MemoryCounterStore(),
    });
    return app.fetch(req, env, ctx);
  },
};
