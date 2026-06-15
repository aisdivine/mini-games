import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under the GitHub Pages subpath
  // (https://aisdivine.github.io/mini-games/land-of-faaa-faaa-away/) as well as
  // on localhost/LAN. The game is published into its own subfolder so the repo
  // can host several mini-games side by side.
  base: './',
  build: { outDir: 'dist/land-of-faaa-faaa-away' },
  // Bind to 0.0.0.0 so phones/tablets on the same Wi-Fi can reach the dev
  // server at http://<your-mac-LAN-IP>:5173 (e.g. http://192.168.5.27:5173).
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
