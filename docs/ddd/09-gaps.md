# 09 — Gaps, Inconsistencies & Issues

<!-- version: 1.1.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-07-07 -->

> **Status 2026-07-07:** addressed by `feature/ui-consolidation`
> (plan `specs/docs/approvedPlans/2026-07-04-ui-consolidation-studio.md`).
> Gaps 1–5, 7–15, 17–22 resolved; 6/16 kept as intended quirks; gap 14's
> kernel-dependent pieces (MessageBus/SharedMemory/asks) await PLAN-00–08.
> See `docs/features/FEATURE-UI-CONSOLIDATION-2026-07-07.md` and
> `FEATURE-ORCHESTRATION-STUDIO-2026-07-07.md` for the resolution map.

Verified issues, classified so a redesign doesn't "fix" intended quirks blindly. Severity:
🔴 functional/UX problem · 🟡 inconsistency · 🟢 intended quirk (decide explicitly).

## A. Cross-panel interaction inconsistencies

| # | Issue | Detail | Sev |
|---|---|---|---|
| 1 | **Scroll-wheel semantics differ** | Session = content offset **×3**; Config = **selection ×1**; Logs = offset **×1**; ScrollableList = offset ×1 | 🟡 |
| 2 | **List nav wrap vs clamp** | Session autocomplete + new-session menu **wrap** (modulo); CommandPalette + ContextMenu **clamp** | 🟡 |
| 3 | **Vim keys only in Logs** | `hjkl` + `c`/`a` letter actions exist only in LogsPanel; no other panel | 🟡 |
| 4 | **ContextMenu lacks Esc + mouse** | No `escape` handling, **no mouse handler at all** — dismissal entirely host-driven; inconsistent with CommandPalette | 🔴 |
| 5 | **H-scroll only in Session** | Horizontal scroll (arrows ×8, table h-scroll) exists nowhere else | 🟢/🟡 |
| 6 | **`override` keyword usage** | SessionPanel omits `override` on `render`/`onKey`; others use it — style drift | 🟢 |
| 7 | **Masking differs** | Config list `maskValue` (prefix + `…▓▓▓▓`) vs import overlay (`slice(0,6)+'…'`) | 🟡 |

## B. Structural / code-design gaps

| # | Issue | Detail | Sev |
|---|---|---|---|
| 8 | **Modal geometry duplicated** | Session pickers vs Config overlays each re-implement border + centering + click-outside with **hard-coded** sizes (46/56/58/64, 10/11/8). No shared `Overlay`/`Modal` | 🔴 |
| 9 | **`app.ts` god object** | ~1100 lines: render loop + all input handling + status-bar hit-testing + per-panel mouse routing. New panels must be wired in multiple places | 🔴 |
| 10 | **Split input pipeline** | Router covers only `[session, canvas, agents]`; Config/Logs/Terminal dispatched explicitly; Terminal raw-bypass. Three code paths | 🟡 |
| 11 | **Version triple-mismatch** | `package.json` 0.4.0 · `index.ts` VERSION 0.3.0 (printed) · StatusBar 0.4.0 | 🔴 |
| 12 | **No shared List behaviour** | Config, Logs, Session-menus each re-implement list scroll/select | 🟡 |

## C. Surface-level functional gaps

| # | Issue | Detail | Sev |
|---|---|---|---|
| 13 | **Canvas authoring is superficial** | "Add agent block" creates a bare rect with **no agent data**; no inspector; **no serialize back to af-plan.json**. Blocks are display-only. (See PLAN-13) | 🔴 |
| 14 | **Agents panel is session-only** | Single-column session list; **no** messages feed, shared-memory, logic ports, `pending`/`skipped` states — not a team dashboard. (See PLAN-10) | 🟡 |
| 15 | **`DEFAULT_MAX_TOKENS = 2048`** | Low for agentic/tool-heavy turns; may truncate replies | 🔴 |
| 16 | **`agent` tool unavailable interactively** | Deliberately not registered (schema rejection); means no nested-agent tool in chat | 🟢 |

## D. Accessibility

| # | Issue | Detail | Sev |
|---|---|---|---|
| 17 | **Color-only status in places** | Log levels and focus rely on color alone (no shape/text redundancy) | 🔴 |
| 18 | **No high-contrast / theme options** | Single hard-coded 256 palette; `accent` == `borderActive` conflates primary/focus | 🟡 |
| 19 | **No reduced-motion option** | Spinners/countdowns always animate | 🟢 |

## E. Responsiveness

| # | Issue | Detail | Sev |
|---|---|---|---|
| 20 | **Fixed split ratios** | 40% session / 70-30 right are hard-coded; no adjustable dividers | 🟡 |
| 21 | **Small terminals untested** | Layout assumes ≥80 cols (modals are 46–64 wide); behaviour <80 cols unspecified | 🔴 |
| 22 | **No min-size guard** | No "terminal too small" message or graceful degradation | 🟡 |

## Intended quirks (do NOT "fix" without a decision)

- **Nobel-laureate session naming + hover tooltip** (a deliberate delight).
- **H-scroll only in Session** (only Session has wide table/code content).
- **`agent` tool not registered interactively** (correctness, not an oversight).
- **`override` keyword drift** (cosmetic).

## Open Design Questions

1. Which inconsistencies (1–7) get **unified** vs **kept** as intentional per-context behaviour?
2. Is fixing the **god object** (9) + **modal duplication** (8) in scope for this UI pass, or a
   follow-up refactor (see 10/11)?
3. What is the **minimum supported terminal size**, and what is the degradation strategy below it?
4. Is **accessibility** (17–19) a goal for this release?
