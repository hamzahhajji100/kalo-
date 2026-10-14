/**
 * Anonymous device tokens: `<base64url(payload)>.<base64url(hmac)>`, payload = { d: deviceId, e: expiry }.
 * They carry no personal data; they only let the API rate-limit per installation.
 */
const enc = new TextEncoder();
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function issueToken(
  secret: string,
  deviceId: string,
  now = Date.now(),
): Promise<{ token: string; expiresAt: string }> {
  const exp = now + TOKEN_TTL_MS;
  const payload = b64url(enc.encode(JSON.stringify({ d: deviceId, e: exp })));
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', await key(secret), enc.encode(payload)),
  );
  return { token: `${payload}.${b64url(sig)}`, expiresAt: new Date(exp).toISOString() };
}

/** Returns the device id for a valid, unexpired token, else null. */
export async function verifyToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<string | null> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await key(secret),
      fromB64url(sig),
      enc.encode(payload),
    );
    if (!ok) return null;
    const { d, e } = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      d?: unknown;
      e?: unknown;
    };
    return typeof d === 'string' && typeof e === 'number' && e > now ? d : null;
  } catch {
    return null;
  }
}
