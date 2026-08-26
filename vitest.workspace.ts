/**
 * Per-block test projects (Stage C of the compartmentalization plan).
 *
 * Run one block's colocated tests in isolation:
 *   npx vitest run --project orchestration
 *   npx vitest run --project features
 *
 * Plain `npm test` (vitest.config.ts) still runs everything.
 */
export default [
  { test: { name: 'contracts',     include: ['packages/contracts/src/**/*.test.ts'] } },
  { test: { name: 'orchestration', include: ['packages/orchestration/src/**/*.test.ts'] } },
  { test: { name: 'core',          include: ['packages/core/src/**/*.test.ts'] } },
  { test: { name: 'shared',        include: ['packages/shared/src/**/*.test.ts'] } },
  { test: { name: 'registry',      include: ['packages/registry/src/**/*.test.ts'] } },
  { test: { name: 'features',      include: ['src/features/**/*.test.ts'] } },
  { test: { name: 'host',          include: ['src/*.test.ts'] } },
]
