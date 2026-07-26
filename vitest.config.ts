import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/.eve/**"],
  },
  resolve: {
    alias: {
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
});
