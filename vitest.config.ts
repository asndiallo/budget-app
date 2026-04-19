import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'lib/pay-tables.ts',
        'lib/les-parser.ts',
        'lib/utils.ts',
        'lib/csv-utils.ts',
        'lib/income.ts',
        'lib/config.ts',
        'lib/brs-calc.ts',
        'lib/bill-match.ts',
        'lib/debt-match.ts',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
