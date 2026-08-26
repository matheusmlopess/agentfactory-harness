import boundaries from 'eslint-plugin-boundaries'
import tsParser from '@typescript-eslint/parser'

/**
 * Architecture boundary enforcement (Stage B of the compartmentalization plan).
 *
 * Encodes the one-directional layering as CI-failing rules: a feature may never
 * import a sibling feature; nobody imports "up" a layer. The compat surface is
 * the `element-types` allow-matrix below — mirror docs/features/ARCHITECTURE-BLUEPRINT.
 *
 * Deep-import banning (only barrels importable) is deferred to Stage D, where
 * package `exports` enforce it naturally.
 */
export default [
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    plugins: { boundaries },
    settings: {
      // Resolve NodeNext ".js" specifiers to their ".ts" source so boundaries
      // can classify the import target. Extracted @factory/* packages resolve
      // as external and are governed by each package.json's dependencies + the
      // per-package tsconfig, not by these src/ element rules.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/ignore': ['src/**/*.test.ts'],
      'boundaries/elements': [
        { type: 'contracts',      pattern: 'src/contracts',      mode: 'folder' },
        { type: 'core',           pattern: 'src/core',           mode: 'folder' },
        { type: 'shared',         pattern: 'src/shared',         mode: 'folder' },
        { type: 'registry',       pattern: 'src/registry',       mode: 'folder' },
        { type: 'harness',        pattern: 'src/harness',        mode: 'folder' },
        // feature-shared: the Feature contract re-export + the registry, at features/ root
        { type: 'feature-shared', pattern: 'src/features/*.ts',  mode: 'file' },
        // each feature = src/features/<name>/**; capture <name> for the sibling ban
        { type: 'feature',        pattern: 'src/features/*',     mode: 'folder', capture: ['feature'] },
        // host = the top-level entry files
        { type: 'host',           pattern: 'src/*.ts',           mode: 'file' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          // contracts references shared/core/orchestration TYPES only (erased);
          // the Feature contract legitimately names shared UI types.
          { from: ['contracts'],      allow: ['contracts', 'orchestration', 'core', 'shared'] },
          { from: ['orchestration'],  allow: ['orchestration'] },
          { from: ['core'],           allow: ['core', 'contracts'] },
          // shared → core is the tracked soft spot (cleaned in Stage D)
          { from: ['shared'],         allow: ['shared', 'contracts', 'core'] },
          { from: ['registry'],       allow: ['registry', 'core', 'contracts'] },
          // doctor inspects registry auth state
          { from: ['harness'],        allow: ['harness', 'core', 'contracts', 'registry'] },
          { from: ['feature-shared'], allow: ['contracts', 'feature-shared'] },
          {
            from: ['feature'],
            allow: [
              'contracts', 'shared', 'core', 'orchestration', 'registry', 'feature-shared',
              // a feature may import ONLY its own files, never a sibling
              ['feature', { feature: '${from.feature}' }],
            ],
          },
          {
            from: ['host'],
            allow: ['host', 'contracts', 'shared', 'core', 'orchestration', 'registry', 'harness', 'feature', 'feature-shared'],
          },
        ],
      }],
    },
  },
]
