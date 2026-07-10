# FEATURE — UI Consolidation + Studio: Operational Guide

<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-07-07 -->
<!-- last-updated: 2026-07-07 -->

Operator-facing guide for everything shipped on `feature/ui-consolidation`: workflows,
edge cases, failure modes, validation, and recovery. Companions:
`FEATURE-UI-CONSOLIDATION-2026-07-07.md` (gap map), `FEATURE-ORCHESTRATION-STUDIO-2026-07-07.md`
(studio internals), `docs/testing/TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md` (test guide).

---

## 1. System at a glance

```
┌─ factory (single binary, local-first) ──────────────────────────────────────┐
│                                                                              │
│  ┌ tab bar ────────────────────────────────────────────────────[ ✕ Quit ]─┐ │
│  │  Session · Orchestration · Agents · Terminal · Config · Logs           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  ┌ Session ────────────┐ ┌ Orchestration (studio) ───────────────────────┐  │
│  │ chat + streaming    │ │ blocks ═ typed wires ═ toolbox ═ inspector    │  │
│  │ model picker        │ ├ Agents ───────────────────────────────────────┤  │
│  │ new-session menu    │ │ session list  OR  team dashboard (during run) │  │
│  └─────────────────────┘ └───────────────────────────────────────────────┘  │
│  ┌ status bar: factory vX.Y.Z [NORMAL] [model] [tools]      ^Q ^E Tab ^R ─┐ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Input path:  stdin ─▶ InputController ─▶ (palette/help modals)             │
│                          ─▶ Keymap (declarative bindings, `?` lists them)   │
│                          ─▶ InputRouter ─▶ active/hit panel                 │
│  Terminal tab: raw bytes ─▶ PTY (only ^Q ^P F1–F5 ⇧PgUp/Dn intercepted)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Ownership boundaries: `src/shared/` = platform (renderer/input/widgets — feature-agnostic);
`src/features/<id>/` = one folder per tab (panel + flows + commands + keybindings);
`src/app.ts` = thin host that loads features from the registry.

---

## 2. Global controls (all tabs except Terminal)

| Key / action | Effect | Notes |
|---|---|---|
| `Ctrl+Q` | Quit | Also the `✕ Quit` button, top-right |
| `Ctrl+C` | Copy Session selection; otherwise quit | OSC 52 clipboard |
| `Ctrl+E` | Toggle native text selection | Status bar shows `[SELECT]` while off |
| `Tab` | Next tab (cycles all six) | On Terminal, Tab goes to the shell instead |
| `F1`–`F6` | Jump to tab; `F1` on Session opens the new-session menu | F6 required the keyboard fix shipped here |
| `Ctrl+P` | Command palette (fuzzy) | Theme, size profile, motion, help, feature commands |
| `?` | Help overlay: every binding for the current tab | Suppressed while typing (Session input, Config edit) |
| `Ctrl+R` | Run the canvas plan | Panel gets first refusal (Config uses it to clear a key) |
| Esc | Closes any transient (modal/menu/palette/help), cancels any mode (wiring/placement/selection) | One consistent convention |
| Click outside a modal | Dismisses it | Same convention as Esc |

**Mouse conventions:** wheel scrolls the viewport, never the selection — ×3 in text panes
(Session transcript, Logs), ×1 in lists. Navigation clamps at list ends everywhere except
the Session slash-autocomplete, which wraps (shell-completion idiom, deliberate).

---

## 3. Workflows

### 3.1 Appearance & accessibility (happy path)

```
Ctrl+P ▶ "theme" ▶ Enter          ─▶ high-contrast applies on next frame
Ctrl+P ▶ "motion" ▶ Enter         ─▶ spinners/countdowns freeze to a static ●
F5 ▶ Interface section ▶ Enter    ─▶ cycles Theme / Reduced motion / Size profile
```

- Settings persist to `~/.config/agentfactory/config.json` under `"settings"`.
- Every status is glyph+text, never color-only: `◎ pending · ● running · ✓ done ·
  ✗ error · ⊘ skipped`; the focused panel title renders inverse-bold.

**Edge cases**
- Config file missing → defaults (default theme, motion on, compact profile). First
  setting change creates the file.
- Config file unwritable → red `⚠ config write: …` banner in the Config panel footer
  (`store.lastWriteError`); the in-memory value still applies for this session.
- Unknown `settings.theme` value → falls back to `default`.

### 3.2 Terminal size & layout (failure mode by design)

```
        resize below profile minimum          resize back
   ┌────────────────────────┐  ┌──────────────────────────────┐
   │  ⚠ Terminal too small  │  │  normal UI restored           │
   │  current 60×20 ·       │  │  (no state lost — the guard   │
   │  minimum 80×24 (compact)│  │   replaces RENDERING only)   │
   │  Resize to continue     │  └──────────────────────────────┘
   │  Ctrl+Q quit · Ctrl+P … │
   └────────────────────────┘
```

- Profiles: compact 80×24 (default) · standard 110×30 · wide 140×40.
- **Input still works behind the guard** — `Ctrl+Q` quits, `Ctrl+P` can switch to a
  smaller profile to recover without resizing.
- Recovery: resize the terminal OR pick a smaller profile. The guard re-evaluates on
  every resize event.
- Dividers: drag the Session|right-column border or the Orchestration|Agents border.
  Ratios clamp to sane ranges (0.25–0.6 / 0.4–0.85) and persist on mouse release.
  Recovery from a bad drag: drag back, or delete `settings["layout.sessionRatio"]` /
  `["layout.canvasRatio"]` from config.json.

### 3.3 Building a plan on the canvas (studio happy path)

```
F2 (Orchestration) ▶ t (toolbox)
   ┌ TOOLBOX [t] ┐
   │ ▸ generic   │   click "worker"  ─▶ placement mode
   │ ▸ planner   │   click a cell    ─▶ node dropped, inspector opens
   │ ▸ worker    │
   │ ▸ reviewer  │   ┌ Edit: agent-1 ─────────────────────────┐
   │ ▸ critic    │   │ id        agent-1█                      │
   └─────────────┘   │ agent     worker                        │
                     │ provider  anthropic     (←/→ cycles)    │
                     │ model     claude-sonnet-4-6             │
                     │ timeout   30                            │
                     │ prompt    Implement: the parser         │
                     │ ✓ valid                                 │
                     │        Tab field · Enter save · Esc ─── │
                     └─────────────────────────────────────────┘

drag  out ○ ──▶ ● in   of another block  ─▶ connector menu:
   ┌──────────────────────────┐
   │ dependency (ordering)    │   dependency wires render ──────▶
   │ handoff: summary         │   handoff wires render   ══[H]══▶
   │ handoff: full            │
   └──────────────────────────┘

Ctrl+S  ─▶ af-plan.json written (with x-studio layout + edge kinds)
Ctrl+R  ─▶ validate ▶ serialize ▶ run: blocks go ◎ ▶ ● ▶ ✓
```

Other canvas interactions: click a block body to **select** (focus border; `Enter`/`e`
opens the inspector; Esc deselects); drag a block **header** to move (grid-snapped,
position persists into the model); right-click for context menus (`Configure…`,
`Delete block`, `Delete wire`, `Add agent block`, `Toggle toolbox`).

**Edge cases & validation (design-time — you cannot save/run an invalid plan)**
```
┌─ blocked with a status-bar error (first fatal issue shown) ────────────────┐
│ • empty plan (no nodes)             • duplicate node id                    │
│ • id not matching a-z0-9_-          • empty agent or prompt                │
│ • dangling edge (deleted node)      • dependency cycle (a→b→a)             │
└─────────────────────────────────────────────────────────────────────────────┘
```
- The inspector blocks bad saves inline (`✗ id "x" already exists`) — Esc cancels safely.
- Renaming a node in the inspector remaps its edges, run status, and selection.
- Duplicate wires and self-loops are silently rejected at wire completion (no menu).
- Legacy `af-plan.json` without `x-studio` loads with an auto-grid layout and plain
  dependency edges — nothing is lost by opening old files.

**Failure modes**
- `Ctrl+S` write failure (disk/permissions) → status-bar error; model unchanged, retry after fixing.
- `af-plan.json` malformed on startup → status-bar error (`ZodError` summary); canvas
  starts empty; fix the file or rebuild and `Ctrl+S` over it.
- Run with no API key → steps stream `step:error` / cascade `⊘ skipped`; the UI stays
  responsive; fix the key in Config (F5) and re-run.

### 3.4 Watching a run (team dashboard)

```
F3 during/after Ctrl+R:
┌ Agents ──────────────────────────────────────────────────────────┐
│ Team — my-plan  [1 running / 3 total]  (Esc: sessions)           │
│ ✓ plan [done] 3.2s     │ build · agent: worker                   │
│ ● build [running]      │  <output / error excerpt>               │
│ ◎ review [pending]     │ 14:23:02 step:done plan (3.2s)          │
│                        │ 14:23:02 step:start build               │
└──────────────────────────────────────────────────────────────────┘
```
- Two columns ≥70 cols; stacked below. ↑/↓ or click selects a step; the right side shows
  its output (or error, in red) and the rolling event log (last 100 events).
- A failed step marks all transitive dependents `⊘ skipped` — the executor's cascade,
  now visible instead of collapsed to idle.
- Esc returns to the session list (sessions mode is untouched, tooltip included).

### 3.5 Headless / automation

```
$ factory run --json            # NDJSON on stdout; human lines on stderr
{"type":"step:start","stepId":"plan","status":"running","ts":"2026-07-07T…"}
{"type":"step:done","stepId":"plan","status":"done","output":"…","durationMs":4,"ts":"…"}
{"type":"plan:done","stepId":"","status":"done","ts":"…"}
$ echo $?                       # 1 if any step errored, else 0
$ factory plan validate         # schema + cycle check (accepts x-studio files)
```

### 3.6 Everything else (unchanged surfaces, new plumbing)

Session chat, model picker (now cached 5 min — reopening is instant), Config key
management (masking unified to `prefix…▓▓▓▓`), Logs (vim keys now listed in `?`),
Terminal PTY (raw bypass byte-identical) all behave as before; they now live as
registry features with the shared Overlay/list/keymap machinery underneath.

---

## 4. Error handling & recovery reference

| Symptom | Cause | Recovery |
|---|---|---|
| `⚠ Terminal too small` screen | size < selected profile | resize, or Ctrl+P → smaller profile |
| Red status-bar message (5s) | plan validation/save/load error | fix the reported issue; message auto-clears |
| `✗ …` line inside the inspector | invalid field value | correct the field; Enter is blocked until `✓ valid` |
| Steps go `✗` then `⊘` | step failed → dependents cascade-skipped | inspect the step in Agents detail; fix prompt/key; re-run |
| `⚠ config write: …` in Config | config.json unwritable | fix permissions; settings apply in-memory meanwhile |
| Copy does nothing | terminal lacks OSC 52 | use `Ctrl+E` native-selection mode and the terminal's copy |
| `[PTY unavailable]` in Terminal | shell spawn failed | check `$SHELL`; other tabs unaffected |

Every transient state is escapable: Esc closes/cancels; the guard screen never traps
input; a running plan finishing (or failing) always returns `planRunning=false`, so
`Ctrl+R` can re-run.

---

## 5. Where things live

```
~/.config/agentfactory/config.json   keys/urls + settings (theme, reducedMotion,
                                     sizeProfile, layout.*Ratio)
~/.config/agentfactory/logs/         structured logs (Logs tab reads these)
./af-plan.json                       the canvas document (valid Plan + x-studio)
/tmp/factory-err.log                 uncaught errors (survive the alt-screen)
```
