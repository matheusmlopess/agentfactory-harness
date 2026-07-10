# TESTING — UI Consolidation + Studio: End-to-End Guide

<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-07-07 -->
<!-- last-updated: 2026-07-07 -->

How to verify `feature/ui-consolidation` end-to-end. Complements
`TESTING-FACTORY-E2E-2026-06-18.md` (Waves 0–5 surfaces); this guide covers the surfaces
that changed: input/keymap, theming/a11y, size profiles, dividers, the studio canvas,
the team dashboard, and NDJSON automation.

---

## 0. Preconditions

```
┌─ Required ────────────────────────────────────────────────────────────────┐
│ • Node ≥ 20, npm install done in the worktree                             │
│ • A real terminal ≥ 120×40 for manual steps (alt-screen, SGR mouse,       │
│   256-color); tmux for the scripted smoke                                 │
│ • Repo: ~/repo/worktrees/ui-consolidation (branch feature/ui-consolidation)│
├─ Optional ────────────────────────────────────────────────────────────────┤
│ • ANTHROPIC_API_KEY for a real plan run (§6 works WITHOUT a key too —     │
│   error/skip paths are part of the test)                                  │
│ • Start clean: no ./af-plan.json in cwd; optionally move                  │
│   ~/.config/agentfactory/config.json aside to test first-run defaults     │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. Automated gates (run first — 5 min)

| # | Command | Expected |
|---|---|---|
| 1 | `npx tsc --noEmit` | no output (strict, no `any`) |
| 2 | `npm test` | **413 passed**, 0 failed |
| 3 | `./scripts/smoke-tui.sh` | `smoke-tui: all checks passed` (13 checks incl. a real 60×20 guard-screen session) |
| 4 | `npx tsx src/index.ts --version` | matches `package.json` `"version"` exactly |

Failure indicators: any tsc output; any red test; smoke `FAIL:` lines (each names the
missing pane content); a version mismatch (means `getVersion()` resolution broke).

## 2. Input, keymap & help

Launch `npx tsx src/index.ts` in a ≥120×40 terminal.

| Step | Expected | Validates |
|---|---|---|
| Press `F1`…`F6` in order | each tab activates — **F6 must reach Logs** (panel shows `Metrics`, not just the tab label) | F6 keyboard fix; keymap tab bindings |
| Press `Tab` repeatedly from Session | cycles orchestration → agents → terminal; on Terminal, Tab types into the shell instead | tab cycle + raw bypass boundary |
| On Logs press `?` | "Keyboard Shortcuts" overlay: Global section + "Logs tab" section (j/k/h/l/c/a listed); ↑/↓ scrolls; Esc closes | help overlay, keymap `list()` |
| On Session type `?` in the input | `?` appears in the chat input — **no** help overlay | text-input suppression |
| On Logs press `j`/`k`, `h`/`l`, `c` | selection moves, source chips cycle, buffer clears | vim keys as keymap contributions |
| In Terminal: type `ls`, `Ctrl+P`, Esc, `⇧PgUp` | shell works; palette opens/closes without leaking to the PTY; scrollback scrolls | bypass byte table |
| Wheel over the Session transcript vs the Config list | transcript jumps 3 lines/tick; Config list moves the viewport 1 row/tick, selection unchanged | wheel conventions |

## 3. Theme, motion, size profiles, dividers

| Step | Expected | Validates |
|---|---|---|
| `Ctrl+P` → "Theme: high contrast" | white-on-black, yellow focus borders, cyan tabs — applies instantly | live token swap |
| `F5` → Interface → Enter on "Theme" | value cycles `[default ▸]` ↔ `[high-contrast ▸]`, applies + persists | Config settings UI |
| Restart the app | theme still high-contrast | settings persistence |
| Toggle "Reduced motion", open Config → login overlay | spinner is a static `●` (no animation); Logs countdown stops ticking | reduced motion |
| `Ctrl+P` → "Size profile: Standard (110×30)", then shrink the terminal below 110×30 | guard screen `⚠ Terminal too small · current …× · minimum 110×30 (standard)`; `Ctrl+P` still opens; picking Compact restores the UI without resizing | guard + input-behind-guard recovery |
| Drag the border between Session and the right column; release; restart | split ratio changed, persists across restart | dividers + persistence |
| Check `~/.config/agentfactory/config.json` | `"settings"` contains `theme`, `sizeProfile`, `layout.sessionRatio` etc.; `"keys"` untouched | storage shape |

## 4. Consolidated widgets (modals, lists, menus)

| Step | Expected |
|---|---|
| Session: click the Session tab while on it → new-session menu; press Esc; reopen; click **outside** the frame | both dismiss it (Esc + click-outside convention) |
| Session: click `[model]` in the status bar | switches to Session + opens the picker; Esc steps back (model→provider) then closes; reopening within 5 min is instant (cache) |
| Config: Enter on a provider → edit modal; Esc cancels (no save); type a key + Enter → `sk-…▓▓▓▓ [set]` shown | Overlay migration + unified masking |
| Orchestration: right-click a block → menu; click a menu **item** | the item executes (items are clickable now); clicking elsewhere or Esc dismisses |

## 5. Studio end-to-end (the core new scenario)

In an **empty directory** (no af-plan.json), run the app, press `F2`:

1. `t` → toolbox appears. Click `worker`, click an empty cell → node drops **and the
   inspector opens**. Set `id` to `build`, prompt to `Build it`, Enter. Expected: `✓ valid`
   then the modal closes; block titled `build`.
2. Repeat for a `reviewer` node `review` (prompt `Review it`).
3. Drag `build`'s right-edge `○` to `review`'s left-edge `●` → connector menu. Pick
   **handoff: summary**. Expected: wire renders `══[H]══`, not `────`.
4. Try wiring `build → review` again → **no menu** (duplicate rejected). Wire `review → build`
   and pick dependency → now press `Ctrl+S`. Expected: red status-bar error `Plan invalid:
   Cycle: …`. Right-click that wire → Delete wire.
5. `Ctrl+S` → then in a shell:

```
$ cat af-plan.json | head            # valid plan + "x-studio" block
$ npx tsx src/index.ts plan validate # → Plan "untitled" is valid (2 steps)
$ grep -A2 '"x-studio"' af-plan.json # layout rows/cols + edges with "kind"
$ grep 'Input from build' af-plan.json  # handoff scaffold appended to review's prompt
```

6. Quit, relaunch in the same directory → **the same graph reappears at the same
   positions** (x-studio round-trip).
7. `Ctrl+R` → blocks go `◎ → ● → ✓` (with a key) or `✗`/`⊘` (without). `F3` → team
   dashboard shows `Team — untitled [n running / 2 total]`, glyph+text rows, the event
   log streaming, and the failed step's error in red when key-less. Esc returns to sessions.
8. Rename test: select `build` (click body), press `e`, change id to `builder`, Enter →
   the wire follows (`builder ══▶ review`), no dangling edge on `Ctrl+S`.

## 6. Automation contract

```
$ npx tsx src/index.ts run --json > events.ndjson; echo "exit=$?"
$ head -1 events.ndjson | python3 -m json.tool     # parses; has type/stepId/status/ts
```
Expected: one JSON object per line on **stdout** only; ISO `ts` on every event;
`exit=1` iff any `step:error` occurred (verify by running key-less), else `exit=0`.

## 7. Correctness confirmation checklist

```
┌─ The implementation is correct when ALL of these hold ─────────────────────┐
│ □ §1 gates green (tsc / 413 tests / 13 smoke checks / version match)       │
│ □ F6 reaches Logs by keyboard; `?` help lists per-tab bindings             │
│ □ Esc AND click-outside dismiss every modal/menu/palette/help              │
│ □ Theme/motion/size/dividers apply live AND survive restart                │
│ □ Guard screen appears below the profile minimum and never traps input    │
│ □ Studio: invalid designs (cycle/dup/empty) blocked at save/run with a     │
│   visible reason; valid designs round-trip through af-plan.json byte-     │
│   stable and pass `factory plan validate`                                  │
│ □ Run statuses show ◎/●/✓/✗/⊘ with text labels (glyphs, not color-only)   │
│ □ run --json: NDJSON stdout, human stderr, exit code reflects failures    │
│ □ Sessions mode of the Agents tab is unchanged (incl. laureate tooltip)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8. Common failure indicators & first moves

| Indicator | Likely cause | First move |
|---|---|---|
| Smoke FAIL on startup checks only | tsx cold-start slower than the poll window | re-run; check `npx tsx src/index.ts` starts at all |
| Keys "do nothing" after a modal | a transient consumed input | Esc (possibly twice); check `?` works |
| Wire won't complete | released on a non-port cell | drop exactly on the `●` (left edge, row 2 of the block) |
| `Ctrl+S` silently "does nothing" | validation failed | read the red status-bar message (5 s); fix, retry |
| Guard screen at a normal size | `settings.sizeProfile` set to wide | Ctrl+P → Compact |
| NDJSON mixed with human text | stdout/stderr not separated by the harness | redirect only stdout (`>`), keep stderr on the tty |
| Tests fail only on `store` mocks | mock missing `getSetting`/`setSetting` | mirror `ConfigPanel.test.ts`'s store mock |
