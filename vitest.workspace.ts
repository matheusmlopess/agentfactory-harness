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
  { test: { name: 'contracts',     include: ['src/contracts/**/*.test.ts'] } },
  { test: { name: 'orchestration', include: ['src/orchestration/**/*.test.ts'] } },
  { test: { name: 'core',          include: ['src/core/**/*.test.ts'] } },
  { test: { name: 'shared',        include: ['src/shared/**/*.test.ts'] } },
  { test: { name: 'registry',      include: ['src/registry/**/*.test.ts'] } },
  { test: { name: 'features',      include: ['src/features/**/*.test.ts'] } },
  { test: { name: 'host',          include: ['src/*.test.ts'] } },
]
