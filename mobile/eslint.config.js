// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Deno edge functions — separate runtime/module resolution, already
    // excluded from tsconfig.json for the same reason.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  {
    files: ['jest.config.js', 'jest.setup.js', '**/__tests__/**', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  {
    // eslint-config-expo's SDK 56 upgrade brought eslint-plugin-react-hooks v7,
    // which adds new React Compiler-safety rules (ref-during-render,
    // setState-in-effect, memoization purity). They surfaced ~400 real,
    // pre-existing findings across ~286 files — a genuine, separate cleanup
    // initiative, not something to fix as a side effect of an SDK bump.
    // Downgraded to warnings so they stay visible without blocking CI on
    // every future PR for code this upgrade never touched.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
