import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Native modules are replaced with Node equivalents for logic tests.
      'expo-sqlite/kv-store': fileURLToPath(new URL('./test/shims/kv-store.ts', import.meta.url)),
      'expo-crypto': fileURLToPath(new URL('./test/shims/expo-crypto.ts', import.meta.url)),
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});
