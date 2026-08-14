import { defineConfig } from "vitest/config";

// Vitest config kept separate from vite.config.ts so the `test` block is a
// native, first-class option (no Vite-type augmentation needed). TSX is
// transformed by esbuild via tsconfig's "jsx": "react-jsx".
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.tsx"],
  },
});
