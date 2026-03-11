import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@browse/shared": resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
