import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // No .env is loaded here, so GMI_API_KEY is undefined => the whole stack
    // runs in deterministic MOCK mode. Tests never hit the network or spend credits.
    testTimeout: 20000,
  },
});
