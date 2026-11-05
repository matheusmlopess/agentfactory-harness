import { defineConfig } from 'tsup'

// The `factory` bin is a single self-contained file. The `@factory/*` workspace
// packages are declared as `dependencies` (so tsup would externalize them by
// default), but they are internal source — their `exports` map points at `.ts`
// files that Node cannot load at runtime. Bundle them into the binary instead.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  noExternal: [/^@factory\//],
})
