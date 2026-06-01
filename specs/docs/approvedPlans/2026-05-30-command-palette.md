# Approved Plan: CommandPalette — Ctrl+P Fuzzy Command Overlay
<!-- version: 1.0.0 -->
<!-- approved: 2026-05-30 -->

## Goal

Implement the `CommandPalette` widget that was listed as a Wave 1 planned item
and has been deferred ever since. Ctrl+P opens a centered modal overlay that lets
the user fuzzy-search and execute any registered app command without touching the
mouse or memorising key bindings.

---

## Scope

| File | Action |
|------|--------|
| `src/tui/widgets/CommandPalette.ts` | **new** — widget: fuzzy match + render + key handler |
| `src/tui/widgets/CommandPalette.test.ts` | **new** — unit tests |
| `src/app.ts` | **extend** — register commands, open/close palette on Ctrl+P / Esc, render overlay last |
| `.ai/project-index.yml` | **update** — flip `CommandPalette.ts` status `planned → implemented`; add test entry |

---

## Reference material

| Decision | Informed by |
|----------|-------------|
| Overlay border + item rendering pattern | `src/tui/widgets/ContextMenu.ts` (existing project) |
| Fuzzy substring scoring approach | `openclaude/src/ink/searchHighlight.ts` — case-insensitive substring scan |
| CellBuffer fill + write API | `src/tui/renderer/cell-buffer.ts` (existing project) |
| Theme / color constants | `src/tui/renderer/theme.ts` (existing project) |

---

## Architecture

### `PaletteCommand` interface

```ts
export interface PaletteCommand {
  id:          string   // unique slug, e.g. 'switch-terminal'
  label:       string   // primary display text, e.g. 'Switch to Terminal'
  hint:        string   // right-aligned shortcut hint, e.g. 'F4'
  action:      () => void
}
```

### `CommandPalette` class

```ts
export class CommandPalette {
  constructor(commands: PaletteCommand[])

  open(): void                          // reset query + selection, ready to render
  get isOpen(): boolean

  render(buf: CellBuffer, rows: number, cols: number): void
  onKey(e: KeyEvent): 'consumed' | 'close' | 'passthrough'
}
```

`onKey` return values:
- `'consumed'`    — key handled internally (query updated, cursor moved)
- `'close'`       — Esc or Enter pressed; caller should close the palette
- `'passthrough'` — unrecognised key; caller may handle it (unused in practice)

### Fuzzy scoring (`fuzzyScore`)

Pure exported function — testable in isolation:

```ts
export function fuzzyScore(label: string, query: string): number
```

| Condition | Score |
|-----------|-------|
| `query === ''` | `3` (show all when empty) |
| `label.toLowerCase().includes(query.toLowerCase())` | `2` |
| every char of `query` appears in `label` in order (subsequence) | `1` |
| otherwise | `0` (filtered out) |

Items are shown in original registration order; no re-ranking within a tier.

### Render layout

The overlay is centered horizontally and positioned at ~25% from the top. Fixed
width = `min(64, cols - 4)`. Height = query row + separator + up to `MAX_VISIBLE`
(8) result rows + bottom border = max 12 rows.

```
row  content
──────────────────────────────────────────────────────────────────
  0  ┌── Command Palette ───────────────────────────────────────┐
  1  │  > <query text>_                                         │
  2  ├──────────────────────────────────────────────────────────┤
  3  │  Switch to Session                                F1     │  ← selected
  4  │  Switch to Orchestration                          F2     │
  5  │  ...up to 8 items...                                     │
     └──────────────────────────────────────────────────────────┘
```

- Selected row: `fg=Colors.bg, bg=Colors.accent, bold`
- Other rows: `fg=Colors.text, bg=Colors.bgActive`
- Hint right-aligned inside the row, `fg=Colors.textDim` (unselected) / `fg=Colors.bg` (selected)
- If filtered list is empty: show `  (no matches)` in `Colors.textDim`

### Commands registered in `app.ts`

| id | label | hint |
|----|-------|------|
| `switch-session` | Switch to Session | F1 |
| `switch-orchestration` | Switch to Orchestration | F2 |
| `switch-agents` | Switch to Agents | F3 |
| `switch-terminal` | Switch to Terminal | F4 |
| `switch-config` | Switch to Config | F5 |
| `run-plan` | Run Plan | Ctrl+R |
| `clear-session` | Clear Session | — |
| `quit` | Quit | Ctrl+Q |

### Integration in `app.ts`

1. `private palette: CommandPalette` — created in `initPanels()` after commands exist
2. `private paletteOpen = false`
3. `listenInput()` — check Ctrl+P **before** all other key handling:
   ```ts
   if (key.key === 'ctrl+p') { this.paletteOpen = true; this.palette.open(); this.render(); return }
   ```
4. When `paletteOpen`, route all keys to palette first:
   ```ts
   if (this.paletteOpen) {
     const result = this.palette.onKey(key)
     if (result === 'close') this.paletteOpen = false
     this.render()
     return
   }
   ```
5. `render()` — call `this.palette.render(buf, rows, cols)` **after** all other panels if `paletteOpen`
6. Ctrl+P while palette is already open → close it (toggle)
7. Terminal tab (raw bypass): Ctrl+P is `0x10` — intercept it in the raw bypass block
   and open palette just like the keyboard path; do **not** forward to PTY.

---

## Test plan (`CommandPalette.test.ts`)

### `fuzzyScore`
- empty query → 3 (show all)
- exact substring (case-insensitive) → 2
- subsequence match → 1
- no match → 0

### `CommandPalette`
- `isOpen` is false before `open()`, true after
- `render()` draws border + query row + item rows in the buffer
- `render()` shows `(no matches)` when query filters everything out
- `onKey('arrow_down')` advances selection, wraps at bottom
- `onKey('arrow_up')` moves selection up, clamps at 0
- `onKey(char)` appends to query, resets selection to 0
- `onKey('backspace')` removes last char from query
- `onKey('escape')` returns `'close'`
- `onKey('enter')` calls action of selected item and returns `'close'`
- hint text is rendered right-aligned inside the row

---

## Key bindings (after this plan)

| Key | Action |
|-----|--------|
| Ctrl+P | Open / close Command Palette (all tabs including Terminal) |
| ↑ / ↓ | Navigate palette items |
| Enter | Execute selected command, close palette |
| Esc | Close palette without executing |
| Any printable char | Append to palette query |
| Backspace | Delete last query character |

---

## Out of scope

- Persistent command history / recently-used ordering
- Mouse interaction with palette items
- Nested sub-palettes
- Dynamic commands from plugins/harness
