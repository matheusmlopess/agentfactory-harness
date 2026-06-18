# Consolidated Implementation Review — `factory` (Waves 0–5)

<!-- version: 1.0.0 -->
<!-- classification: REVIEW -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-06-18 -->
<!-- Scope: the IMPLEMENTED app (Waves 0–5). Synthesizes docs/ddd/09–11 into a single review. -->
<!-- Companion: docs/ddd/ (design reference), docs/ddd/TESTING-E2E.md (test guide). -->

> **What this is:** a design analysis of the implemented system — reasoning & trade-offs,
> assumptions, gaps/risks, missing scenarios, and enhancements. It does **not** cover
> infrastructure (none: no Docker/Compose/Ansible) or any "operator console / routes"
> (none: this is a single-binary CLI/TUI, not a routed service).

---

## 1. Design reasoning & trade-offs

| Decision | Reasoning | Trade-off accepted |
|---|---|---|
| **No UI framework; custom cell-buffer renderer** | Full control of ANSI output, zero framework overhead, one self-contained binary | Must hand-build diffing, layout, focus, widgets; more code to own |
| **Minimal-diff frame output** (`CellBuffer.diff`) | Emit only changed cells → tiny writes, smooth streaming | Diff is O(cells) per frame; no region-level skip yet |
| **Event-driven render** (`scheduleRender` + `setImmediate`) | Paint only when state changes; coalesce bursts into one frame | Two render paths (scheduled vs synchronous) to reason about |
| **Anthropic `MessageParam` as canonical history** | One internal format; adapters convert outward | OpenAI adapter must translate every turn (tool_calls, tool role) |
| **`activeTab` is the single focus source** | Simple, predictable; one place decides routing | Couples focus to tabs; non-tab focus (overlays) handled ad hoc |
| **Shell-script hooks** (`.ai/hooks/*.sh`, `{continue}` only) | Language-agnostic, no in-proc coupling | No return-data channel (cannot inject context — blocks multi-agent needs) |
| **Local-first files** (`~/.config/agentfactory/…`) | No server dependency; works offline; transparent | No sync/multi-device; secrets sit in a plaintext JSON (mode-guarded) |
| **`agent` tool not registered interactively** | Its Zod schema would reject the model's free-form input in the shared registry | No nested-agent tool in chat; orchestration is the path instead |
| **Tools receive only parsed input (no context)** | Simple tool contract | Blocks team features (message/memory/ask) — addressed by PR #23 `ToolUseContext` |
| **Raw-byte bypass for the Terminal tab** | Real shell fidelity (keys reach PTY unmodified) | A third input path; only a few keys intercepted |
| **Nobel-laureate session naming + tooltip** | Memorable identity, light delight | Cosmetic coupling to `nobel.ts`; not functional |

---

## 2. Assumptions baked into the implementation

```
┌─ Environment assumptions ────────────────────────────────────────────────┐
│ • Terminal width ≥ ~80 cols (modals are 46–64 wide; splits are fixed %).  │
│ • Terminal supports: alt-screen, SGR mouse (1000/1003/1006), 256-color,   │
│   truecolor, OSC 8 hyperlinks, OSC 52 clipboard, bracketed paste.         │
│ • Node ≥ 20 (only enforced by `doctor`, not package.json `engines`).      │
│ • A POSIX-ish shell ($SHELL or bash) exists for the Terminal panel.       │
│ • Single local user; one config file; no concurrency across processes.    │
│ • API keys available via env or ~/.config/agentfactory/config.json.       │
│ • Network reachable for LLM calls and registry/device login.              │
│ • One UTF-16 code unit per cell (no multi-codepoint glyphs in the grid).  │
└───────────────────────────────────────────────────────────────────────────┘
```

When an assumption breaks, behavior ranges from graceful (PTY spawn failure →
`[PTY unavailable]`; config write failure → `store.lastWriteError` banner) to **unverified**
(width < 80, missing terminal capabilities — see gaps).

---

## 3. Identified gaps & risks (severity-ranked)

Pulled from `docs/ddd/09-gaps.md`; the highest-impact items:

| # | Gap / risk | Impact | Sev |
|---|---|---|---|
| R1 | **`app.ts` god object** (~1100 lines: render + input + hit-test) | New surfaces must be wired in 3+ places; high change-risk | 🔴 |
| R2 | **Modal geometry duplicated** (3+ hand-rolled overlays, hard-coded sizes) | Inconsistent UX; bug surface; hard to restyle | 🔴 |
| R3 | **`DEFAULT_MAX_TOKENS = 2048`** | Truncated replies on tool-heavy/long turns | 🔴 |
| R4 | **Version triple-mismatch** (0.4.0 / 0.3.0 / 0.4.0) | `--version` is wrong; release ambiguity | 🔴 |
| R5 | **<80-col / capability assumptions untested** | Layout breakage; no min-size guard; no capability fallback | 🔴 |
| R6 | **Color-only status in places** (log levels, focus) | Accessibility; ambiguous state | 🔴 |
| R7 | **Canvas authoring superficial** (no agent data, no serialize) | Visual plan-building is non-operational (see PLAN-13) | 🔴 |
| R8 | **Split input pipeline** (router for 3 panels, explicit for 3, raw for terminal) | Easy to miss-wire; inconsistent dispatch | 🟡 |
| R9 | **Inconsistent interactions** (wheel ×1/×3/selection; wrap vs clamp; vim only in Logs) | Learnability; muscle-memory misfires | 🟡 |
| R10 | **Plaintext secrets in config.json** | Key exposure if file/host compromised | 🟡 |

---

## 4. Missing scenarios (not handled or unverified)

```
┌─ Failure / edge cases the current code does NOT clearly handle ──────────┐
│ NETWORK                                                                   │
│  • LLM stream drops mid-response → partial line; no retry/backoff.        │
│  • Rate-limit / 429 from provider → surfaced as a raw error line only.    │
│  • Device-login poll timeout / network loss → overlay may stall.          │
│ INPUT / DATA                                                              │
│  • Malformed tool-call JSON from the model → JSON.parse may throw         │
│    inside the loop (dispatch is guarded, accumulation is not).            │
│  • Extremely long single line / huge tool output → wrap + scroll cost.    │
│  • Invalid/expired API key → fails at send; no proactive validation.      │
│ TERMINAL                                                                  │
│  • Resize during an active stream → handled (full repaint) but untested   │
│    under load.                                                            │
│  • Terminal without OSC 52 → copy silently no-ops (no fallback notice).   │
│  • Width < 80 cols → modal/layout overflow unverified.                    │
│ ORCHESTRATION                                                             │
│  • Step timeout field exists in schema but enforcement is not wired.      │
│  • Long-running step with no output → no progress signal.                 │
│ CONCURRENCY                                                               │
│  • Two `factory` processes writing config.json → last-write-wins, no lock.│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Potential enhancements

**Short-term (polish / low-risk — see `docs/ddd/10-optimizations.md` P0–P2):**
- Single `VERSION` source; centralize `mask()`; one input-convention table.
- Shared `Overlay`/`Modal` widget and `ListBehavior` (removes R2, R9).
- Semantic theme tokens + a consistent focus affordance (R6).
- Raise/auto-size `DEFAULT_MAX_TOKENS` per model (R3).
- Min-terminal-size guard + capability detection with graceful fallback (R5).

**Long-term (structural / features — P3–P5):**
- Extract `InputController` + keymap from `app.ts`; adopt the `Feature` registry
  (`docs/ddd/11-feature-isolation.md`) — dissolves R1/R8.
- Operationalize the canvas (PLAN-13) and the Agents team dashboard (PLAN-10).
- In-process hooks with a return channel (unblocks multi-agent context injection, PR #23).
- Structured JSON output mode for `run` (automation).

---

## 6. Additional checks & safeguards to add

| Safeguard | Why |
|---|---|
| **Redact API keys in logs** | Logger writes structured meta; ensure no key/token leaks into `factory-*.log` |
| **Retry/backoff on transient LLM errors (429/5xx)** | Today a transient error ends the turn |
| **Guard tool-input `JSON.parse`** | Wrap accumulation parse; emit a tool error instead of throwing the loop |
| **Proactive key validation** | A "test key" action in Config (cheap models.list call) before first use |
| **Config file lock or atomic write** | Prevent corruption under concurrent processes |
| **Capability detection** | Probe OSC 52 / truecolor; fall back + notify when absent |
| **Min-size guard** | Render a "terminal too small (need ≥ N×M)" message instead of overflowing |
| **Step timeout enforcement** | Honor `StepSchema.timeout` in the executor (abort + skip on expiry) |
| **AbortSignal on quit** | Ensure an in-flight stream is aborted on `Ctrl+Q` (avoid orphaned requests) |

---

## 7. Verdict

The implemented system (Waves 0–5) is **coherent and functional**: a custom-rendered TUI with
a streaming multi-provider agent loop, DAG orchestration, an embedded PTY, 35-provider key
management, and structured logging — all local-first. The principal risks are **structural**
(`app.ts` god object, duplicated overlays) and **robustness** (token cap, network/edge failure
handling, terminal-capability assumptions), not correctness of the core happy paths. The
short-term consolidations in §5 remove most UX inconsistencies cheaply; the `Feature` registry
(§5 long-term) is the highest-leverage structural investment and unblocks the specced
multi-agent work.

*See `docs/ddd/TESTING-E2E.md` for the end-to-end test procedure that validates these surfaces.*
