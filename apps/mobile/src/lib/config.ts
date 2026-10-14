/**
 * Runtime configuration from EXPO_PUBLIC_* variables (inlined at build time).
 * Only non-secret values belong here; API keys live on the Kalo backend.
 */
export const config = {
  /** Base URL of the Kalo API (AI photo analysis, label OCR, USDA proxy). Null disables those features. */
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || null,
} as const;
