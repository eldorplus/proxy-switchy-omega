// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import AutoImport from 'unplugin-auto-import/vite';

export default defineConfig({
  plugins: [
    AutoImport({
      imports: ['vitest'],
      dts: true, // generate TypeScript declaration
    }),
  ],
  test: {
    globals: true,
    deps: {
      interopDefault: true,
      moduleDirectories: ['node_modules', resolve('../../packages')],
    },
  },
});
