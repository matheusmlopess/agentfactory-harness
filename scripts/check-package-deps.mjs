#!/usr/bin/env node
/**
 * Cross-package boundary check (closes gap C1).
 *
 * ESLint governs src/ (the feature-sibling ban); npm does NOT block a package
 * from importing an undeclared sibling workspace package. This script does:
 *
 *   1. Every `@factory/*` a package's source imports MUST be listed in that
 *      package's package.json dependencies (and likewise the root app).
 *   2. The `@factory/*` dependency graph MUST be acyclic (catches type-only
 *      cycles that value-import-based tooling misses).
 *
 * Exit 1 with a precise message on any violation. Run by `npm run lint` + CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const IMPORT_RE = /(?:import|export)\b[^'"]*?from\s*['"](@factory\/[^'"]+)['"]|import\(\s*['"](@factory\/[^'"]+)['"]\s*\)/g

function pkgName(spec) { // '@factory/core/llm/index.js' -> '@factory/core'
  const [scope, name] = spec.split('/')
  return `${scope}/${name}`
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (e.endsWith('.ts')) out.push(p)
  }
  return out
}

/** Collect @factory/* packages imported by the .ts files under `dir`. */
function importsUnder(dir) {
  const found = new Set()
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2]
      if (spec) found.add(pkgName(spec))
    }
  }
  return found
}

const errors = []

// Build the unit list: each workspace package + the root app.
const units = []
const packagesDir = join(ROOT, 'packages')
for (const name of readdirSync(packagesDir)) {
  const pj = JSON.parse(readFileSync(join(packagesDir, name, 'package.json'), 'utf8'))
  units.push({
    name: pj.name,
    srcDir: join(packagesDir, name, 'src'),
    deps: new Set(Object.keys(pj.dependencies ?? {}).filter(d => d.startsWith('@factory/'))),
  })
}
const rootPj = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
units.push({
  name: '(root app)',
  srcDir: join(ROOT, 'src'),
  deps: new Set(Object.keys(rootPj.dependencies ?? {}).filter(d => d.startsWith('@factory/'))),
})

// 1. Every imported @factory/* must be a declared dependency.
const graph = new Map()
for (const u of units) {
  const imported = importsUnder(u.srcDir)
  imported.delete(u.name) // self-imports (root app has no self)
  graph.set(u.name, imported)
  for (const dep of imported) {
    if (!u.deps.has(dep)) {
      errors.push(`${u.name} imports ${dep} but does not declare it in package.json dependencies`)
    }
  }
}

// 2. The @factory graph must be acyclic.
const WHITE = 0, GREY = 1, BLACK = 2
const color = new Map([...graph.keys()].map(k => [k, WHITE]))
const stack = []
function dfs(n) {
  color.set(n, GREY); stack.push(n)
  for (const m of graph.get(n) ?? []) {
    if (!graph.has(m)) continue // external (e.g. root app not a dep target)
    if (color.get(m) === GREY) {
      const i = stack.indexOf(m)
      errors.push(`dependency cycle: ${[...stack.slice(i), m].join(' -> ')}`)
    } else if (color.get(m) === WHITE) dfs(m)
  }
  color.set(n, BLACK); stack.pop()
}
for (const n of graph.keys()) if (color.get(n) === WHITE) dfs(n)

if (errors.length) {
  console.error('✗ package boundary check failed:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(`✓ package boundary check: ${units.length} units, all @factory imports declared, graph acyclic`)
