import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Self-contained second game in the mini-games repo. Its own Vite root so it
// builds independently of the stronghold game; output drops into the shared
// dist/ under its own slug for GitHub Pages.
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../../dist/worldly-farm', import.meta.url)),
    emptyOutDir: true,
  },
  server: { host: true },
  test: {
    root,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
