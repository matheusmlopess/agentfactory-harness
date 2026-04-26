# Plan: Wave 0 — Scaffold
<!-- version: 1.0.0 -->
<!-- approved: 2026-04-26 -->

## Context

Bootstrap the `agentfactory-harness` repo. Establish the rendering foundation and
project skeleton so all subsequent waves have a working harness to build on.
No Claude API calls, no mouse events, no orchestration yet — this is the skeleton.

## Scope

| File | Action |
|------|--------|
| `package.json` | tsup, tsx, commander, @anthropic-ai/sdk, node-pty, zod, vitest, @types/node |
| `tsconfig.json` | strict mode, ESNext, NodeNext module resolution |
| `src/index.ts` | Entry: parse args via commander → App or doctor |
| `src/cli.ts` | commander program definition |
| `src/app.ts` | App class: owns render loop, input loop, cleanup |
| `src/tui/renderer/ansi.ts` | ANSI sequence builders (cursor, colors, screen) |
| `src/tui/renderer/cell-buffer.ts` | Cell[][], write(), diff(), flush() |
| `src/tui/renderer/layout.ts` | Panel grid, SIGWINCH resize |
| `src/tui/renderer/theme.ts` | Color palette, box-drawing char constants |
| `src/tui/input/keyboard.ts` | stdin raw mode → KeyEvent |
| `src/tui/panels/Panel.ts` | Abstract base: rect, render(buf), onKey() |
| `src/tui/panels/StatusBar.ts` | Bottom line: version, mode |
| `src/harness/doctor.ts` | /doctor: ANTHROPIC_API_KEY, node version, harness |
| `README.md` | Project overview |
| `.gitignore` | node_modules, dist, .env |

## Implementation notes

- App enters alt-screen (`\033[?1049h`) on start, restores on exit
- Mouse enabled (`\033[?1000h\033[?1002h\033[?1006h`) but not yet handled
- Static layout: tab bar at top, 3 panel regions, status bar at bottom
- `factory --version` → print version and exit (no full-screen)
- `factory doctor` → print health table and exit (no full-screen)
- All panels render placeholder content ("Wave N — coming soon")
- SIGWINCH → layout.resize() → re-render
- SIGINT / `q` → cleanup → exit 0

## Verification

- [ ] `npm run build` — zero TypeScript errors
- [ ] `node dist/index.js --version` — prints `factory v0.1.0`
- [ ] `node dist/index.js doctor` — prints health check table (no full-screen)
- [ ] `npm run dev` — renders full-screen static layout
- [ ] Resize terminal window → redraws without artifacts
- [ ] Press `q` → clean exit, terminal restored
- [ ] `npm test` — skeleton test passes
