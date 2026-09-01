/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Playwright E2E specs and dependency-package test files are not project tests.
    // Keep them excluded so every Vitest invocation only runs repository tests.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});