import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Fakes for the native modules that cannot load on Node.js.
    setupFiles: ['./test/setup.ts'],
  },
});
