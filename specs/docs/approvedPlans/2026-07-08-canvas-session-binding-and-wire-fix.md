# Plan: Canvas Wire-Routing Crash Fix + Canvas ↔ Agents ↔ Sessions Binding
<!-- version: 1.0.0 -->
<!-- classification: PLAN -->
<!-- date: 2026-07-08 -->
<!-- last-updated: 2026-07-08 -->

Approved plan for two workstreams on `feature/ui-consolidation`: (A) fix the
reproduced `routeWire` infinite-loop crash, (B) give sessions a stable id and
bind canvas agent nodes to real chat sessions so the three surfaces (canvas,
Agents list, Session tab) act as one system.

## Context

The TUI crashed while authoring on the Orchestration Canvas. Root cause,
reproduced headlessly: `routeWire()` (`src/features/canvas/Wire.ts`) never
terminates when a wire's endpoints share a column (or the target is exactly
one column left of the source) on different rows — the trailing-horizontal
loop steps past `to.col` and pushes points forever until the process dies of
memory exhaustion. An OOM kill is a fatal V8 error, not a thrown exception,
so `/tmp/factory-err.log` (the `uncaughtException` dump) was never written.
The hang is trivially reachable because the wire-drag preview routes to the
live mouse cursor on every frame (`src/features/canvas/panel.ts`).

Separately, canvas agent nodes, the Agents list, and chat sessions shared no
identity: `StudioNode` had no session reference, plan runs used throwaway
`Session` objects invisible to the UI, and clicking an Agents row switched the
active session without navigating to it.

## Workstream A — crash fix

- **A1** Rewrite `routeWire` with direction-safe loops: every segment steps by
  `Math.sign(end − start)` of its OWN delta; a zero-length segment never
  enters its loop. Vertical / near-vertical wires end in a `▼`/`▲` arrow.
  Corner glyph orientation fixed for right-to-left / upward wires.
- **A2** Regression tests in `src/features/canvas/wire.test.ts`: both hang
  fixtures, exhaustive small-grid bound + duplicate-free fuzz, contiguity,
  corner orientation for all four L directions.
- **A3** `App.renderTab` wraps panel render in try/catch: logs once per
  distinct error, paints a `⚠ <title> failed to render — see Logs` state,
  never rethrows. (Catches throws only; A1 is the fix for non-terminating
  renders.)

## Workstream B — session binding

Identity model: a session's stable id is its **rollout id** (already unique,
persistent, and resumable). Canvas nodes carry an optional `sessionId`,
serialized through the additive `x-studio.sessions` map (nodeId → sessionId).
Canvas-created agents become **real sessions**, so the Agents list — a pure
projection of `sessionMetas()` — shows them with zero merge logic.

- **B1** `SessionPanel`: `SessionRecord.id` (= rollout id), exported
  `SessionMeta`, `switchToId`, `createSession` (no focus steal),
  `resumeById`, `postMessage`; `runAgentLoop` returns the assistant text.
- **B2** `SessionBridge` (services key `'session'`) exposes the new methods.
- **B3** `StudioExtSchema.sessions` (defaults `{}`, legacy plans parse);
  `StudioNode.sessionId?` round-trips through `studioToPlan`/`planToStudio`.
  `studio-model.ts` stays TUI-free.
- **B4** Canvas UX: injected `CanvasSessionActions`; `addNode` auto-creates +
  binds a session named after the node; block context menu gains
  `Open session` / `Bind session…` (+ `Unbind`); `o` opens the selected
  node's session; dangling bindings self-heal (resume or fresh create +
  rebind). Deleting a node keeps its session.
- **B5** Plan runs execute each step through its node's bound session via
  `postMessage` (throwaway path kept as a bridge-less fallback), so run
  output is inspectable in the Session tab and visible in the Agents list.
- **B6** Agents list click = `switchTo(idx)` + `switchTab('session')`.

## Verification

`npx tsc --noEmit` and `npx vitest run` green (47 files / 442 tests, 20 new).
Manual: drag a wire straight down between two stacked blocks (previously
froze); toolbox-drop a node → appears in Agents; right-click → Open session;
`Ctrl+S` writes `x-studio.sessions`; `Ctrl+R` streams steps into real
sessions.

Feature doc: `docs/features/FEATURE-CANVAS-SESSION-BINDING-2026-07-08.md`.
