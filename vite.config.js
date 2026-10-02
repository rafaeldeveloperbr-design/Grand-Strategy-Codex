/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
  test: {
    // Engine tests are pure state transitions; using a browser environment
    // unnecessarily couples them to jsdom/undici versions in CI.
    environment: 'node',
    globals: true,
    include: ['src/engine/__tests__/**/*.test.ts'],
  }
});
