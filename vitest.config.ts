import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/*.test.ts', 'src/main.tsx'],
    },
  },
});
