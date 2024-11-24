// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    deps: {
      moduleDirectories: ['node_modules', resolve('../../packages')],
    },
  },
});
