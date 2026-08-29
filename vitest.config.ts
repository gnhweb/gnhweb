/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Playwright E2E specs are executed by the Playwright runner, not Vitest.
    // Keep the exclusion in the config so every CI/local Vitest invocation is safe.
    exclude: ['tests/e2e/**'],
  },
});