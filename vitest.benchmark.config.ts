import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/benchmark/**/*.test.ts"],
    reporters: ["verbose"],
  },
  define: {
    CSB_SDK_VERSION: JSON.stringify("2.5.0"),
  },
});
