import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Coverage is scoped to the modules that actually have tests today; broad
      // whole-src coverage would be noise until more suites land.
      include: [
        'src/config/robotRiskParams.ts',
        'src/hooks/useTradingCalculations.tsx',
      ],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.config.{ts,js}',
      ],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 40,
        lines: 50,
      },
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});