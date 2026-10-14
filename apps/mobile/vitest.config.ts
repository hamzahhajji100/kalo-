import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Native modules are replaced with Node equivalents for logic tests.
      'expo-crypto': path.resolve(__dirname, 'test/shims/expo-crypto.ts'),
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});
