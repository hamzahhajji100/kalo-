import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';

import { config } from './config';
import { newId } from './id';
import { requestJson } from './http';

const DEVICE_ID_KEY = 'kalo.deviceId';
const TOKEN_KEY = 'kalo.apiToken';

/** Anonymous, random device id. Not linked to any personal data. */
export function deviceId(): string {
  let id = Storage.getItemSync(DEVICE_ID_KEY);
  if (!id) {
    id = newId();
    Storage.setItemSync(DEVICE_ID_KEY, id);
  }
  return id;
}

const TokenResponse = z.object({ token: z.string().min(1), expiresAt: z.string() });

/** Get (or refresh) the signed device token the backend uses for rate limiting. */
async function token(): Promise<string | null> {
  if (!config.apiUrl) return null;
  const cached = Storage.getItemSync(TOKEN_KEY);
  if (cached) {
    const { token: t, expiresAt } = JSON.parse(cached) as z.infer<typeof TokenResponse>;
    if (Date.parse(expiresAt) - Date.now() > 60_000) return t;
  }
  const res = await requestJson(`${config.apiUrl}/v1/device`, {
    schema: TokenResponse,
    method: 'POST',
    body: { deviceId: deviceId() },
    timeoutMs: 6000,
  });
  Storage.setItemSync(TOKEN_KEY, JSON.stringify(res));
  return res.token;
}

export async function apiHeaders(): Promise<Record<string, string>> {
  const t = await token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Forget the cached token (e.g. after a 401). */
export function clearApiToken(): void {
  Storage.removeItemSync(TOKEN_KEY);
}
