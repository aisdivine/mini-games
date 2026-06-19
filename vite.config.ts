import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under the GitHub Pages subpath
  // (https://aisdivine.github.io/mini-games/land-of-faaa-faaa-away/) as well as
  // on localhost/LAN. The game is published into its own subfolder so the repo
  // can host several mini-games side by side.
  base: './',
  build: { outDir: 'dist/land-of-faaa-faaa-away' },
  // Bind to 0.0.0.0 so phones/tablets on the same Wi-Fi can reach the dev
  // server at http://<your-mac-LAN-IP>:5173 (Vite prints the Network URL on start).
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Several sim tests fast-forward thousands of deterministic ticks (raids,
    // pathfinding, full battles). They're well under a second each in isolation
    // but can exceed the 5s default under parallel CPU contention.
    testTimeout: 20000,
  },
} as Parameters<typeof defineConfig>[0]);
