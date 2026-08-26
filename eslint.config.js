import boundaries from 'eslint-plugin-boundaries'
import tsParser from '@typescript-eslint/parser'

/**
 * Architecture boundary enforcement.
 *
 * After Stage D the platform libraries (contracts, core, shared, orchestration,
 * registry) are `@factory/*` workspace PACKAGES — their boundaries are enforced
 * by each package.json's `dependencies` (and their per-package tsconfig). They
 * resolve as external here and are intentionally not governed by these rules.
 *
 * What remains in `src/` is the host + the features. This config enforces the
 * one guarantee that lives there: **a feature may never import a sibling
 * feature** (cross-feature capability goes through the typed ServiceRegistry in
 * @factory/contracts). It also keeps features from importing the host/harness.
 */
export default [
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    plugins: { boundaries },
    settings: {
      // Resolve NodeNext ".js" specifiers to their ".ts" source so boundaries
      // classifies intra-src imports; @factory/* packages resolve external.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/ignore': ['src/**/*.test.ts'],
      'boundaries/elements': [
        { type: 'harness',        pattern: 'src/harness',       mode: 'folder' },
        // feature-shared: the Feature contract re-export + the feature registry
        { type: 'feature-shared', pattern: 'src/features/*.ts', mode: 'file' },
        // each feature = src/features/<name>/**; capture <name> for the sibling ban
        { type: 'feature',        pattern: 'src/features/*',    mode: 'folder', capture: ['feature'] },
        // host = the top-level entry files (app.ts, cli.ts, index.ts)
        { type: 'host',           pattern: 'src/*.ts',          mode: 'file' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          // @factory/* packages are external → auto-allowed; only intra-src edges below.
          { from: ['harness'],        allow: ['harness'] },
          { from: ['feature-shared'], allow: ['feature-shared'] },
          {
            from: ['feature'],
            // a feature may import ONLY its own files (+ the feature-shared
            // types re-export); never a sibling feature, never host/harness.
            allow: ['feature-shared', ['feature', { feature: '${from.feature}' }]],
          },
          { from: ['host'], allow: ['host', 'harness', 'feature', 'feature-shared'] },
        ],
      }],
    },
  },
]
