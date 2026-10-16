import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// GitHub Pages ではリポジトリ名がパスに入るため、BASE_PATH で切り替える。
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [preact()],
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
