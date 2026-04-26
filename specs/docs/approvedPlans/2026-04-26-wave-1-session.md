# Approved Plan: Wave 1 — Session + Agent Loop
<!-- version: 1.0.0 -->
<!-- approved: 2026-04-26 -->

## Goal

Wire the Claude API into the `factory` TUI. The agent loop is the core deliverable —
everything else (SessionPanel, tools, hooks, slash commands) builds on top of it.

## Research summary

Reference repos cloned to `.refs/` and deleted post-research. Key findings:

**Agent loop shape** — async generator, `while(true)` + mutable state, stops on
`end_turn`, maxTurns exceeded, or AbortController signal. All three stop conditions
must be tested explicitly.

**SDK streaming** — accumulate `input_json_delta` event strings; parse to JSON
only at `content_block_stop`. Never pass partial JSON to tool dispatch.

**Tool result wire format**:
```typescript
{ role: 'user', content: [{ type: 'tool_result', tool_use_id: string, content: string }] }
```

**Prompt caching** — attach `cache_control: { type: 'ephemeral', ttl: '1h', scope: 'global' }`
to system message blocks. Shared across turns within the same session.

**Slash commands** — `value.trim().startsWith('/')` detection, routed through a
priority queue with `now / next / later` buckets.

**Concurrency** — partition tools at dispatch time: concurrency-safe tools (Read,
WebFetch) run in parallel; destructive tools (Bash, Write, Agent) run serially.

---

## Architecture decisions

### Why async generator (not EventEmitter)?

`AsyncIterable<AgentEvent>` lets callers consume events with `for await` — the same
pattern as the Anthropic SDK's streaming interface. No listener registration, no
off-by-one risk on buffered events, trivially composable with other async generators.

### Why accumulate delta strings?

The Anthropic streaming protocol sends `input_json_delta` events with partial JSON
chunks. Parsing each chunk independently would throw on every intermediate event.
Accumulating into a string and parsing once at `content_block_stop` is the only
correct approach.

### Why serial for Bash/Write?

Concurrent mutations to the filesystem or shell state produce non-deterministic
results. Bash and Write are serialised to preserve the intuitive "one step at a time"
mental model. Read and WebFetch have no write-side effects and can safely fan out.

---

## Files to create

| File | Wave | Purpose |
|------|------|---------|
| `src/core/agent-loop.ts` | 1 | `async function* agentLoop(...)` — streaming Claude loop |
| `src/core/session.ts` | 1 | `Session` class — history, token count |
| `src/core/hooks.ts` | 1 | `runHook(event, ctx)` — lifecycle events |
| `src/core/tools/index.ts` | 1 | Registry + `dispatch(name, input)` |
| `src/core/tools/bash.ts` | 1 | `BashTool` — exec with timeout |
| `src/core/tools/read.ts` | 1 | `ReadTool` — fs.readFile |
| `src/core/tools/write.ts` | 1 | `WriteTool` — fs.writeFile |
| `src/core/tools/web-fetch.ts` | 1 | `WebFetchTool` — fetch + text |
| `src/tui/panels/SessionPanel.ts` | 1 | Chat panel — streaming display + input bar |
| `src/tui/panels/AgentsPanel.ts` | 1 | Agent list sidebar (stub → basic status badges) |
| `docs/FEATURE-WAVE-1-SESSION.md` | 1 | Rule 3 feature doc |

---

## Public API: agent loop

```typescript
// AgentEvent union — streamed to consumers
export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string; id: string }
  | { type: 'tool_result'; id: string; content: string }
  | { type: 'turn_end'; stop_reason: string }
  | { type: 'error'; error: Error };

// Entry point
export async function* agentLoop(
  session: Session,
  opts: { maxTurns?: number; signal?: AbortSignal }
): AsyncIterable<AgentEvent>
```

---

## Public API: session

```typescript
export class Session {
  addMessage(msg: MessageParam): void
  getHistory(): MessageParam[]
  tokenCount(): number   // approximate, based on char length / 4
  clear(): void
}
```

---

## Public API: hooks

```typescript
export type HookEvent =
  | 'PreToolUse' | 'PostToolUse'
  | 'SessionStart' | 'SessionStop'
  | 'StepStart' | 'StepComplete';

export interface HookResult { continue: boolean; modified?: unknown }

export async function runHook(
  event: HookEvent,
  ctx: Record<string, unknown>
): Promise<HookResult>
```

Hooks read from `.ai/hooks/<event>.sh` if the file exists and is executable.
Non-zero exit = abort (for PreToolUse) or log (for others).

---

## Public API: tool registry

```typescript
export interface Tool<I = unknown, O = unknown> {
  name: string
  description: string
  inputSchema: z.ZodSchema<I>
  run(input: I): Promise<O>
  concurrent?: boolean   // default false
}

export function registerTool(tool: Tool): void
export async function dispatch(name: string, input: unknown): Promise<string>
```

---

## SessionPanel layout

```
┌─ Session ──────────────────────────────────────────────────────────┐
│                                                                     │
│  [Claude output scrollback — up/down to scroll]                    │
│                                                                     │
│  > streaming text lands here as AgentEvent text_delta fires        │
│                                                                     │
│─────────────────────────────────────────────────────────────────── │
│  > _ [user input bar — Enter sends, / prefix = slash command]      │
└────────────────────────────────────────────────────────────────────┘
```

Input bar at the bottom row of `inner` Rect. All other rows = scrollback.
Slash commands are detected before dispatch to `agentLoop`.

---

## Test targets (Rule 7: 80%+)

| File | Key scenarios |
|------|--------------|
| `src/core/agent-loop.test.ts` | end_turn stop, maxTurns stop, tool round-trip, signal abort |
| `src/core/session.test.ts` | addMessage, getHistory order, tokenCount estimate |
| `src/core/tools/bash.test.ts` | success, non-zero exit, timeout |
| `src/core/tools/read.test.ts` | read existing file, missing file error |

---

## Release

- Branch: `feature/wave-1-session`
- PR title: `feat: Wave 1 — Claude streaming agent loop, session, tools, hooks`
- Tag: `v0.2.0` (package.json bump in the PR)
- Milestone update: flip W1 row to ✓ done after merge
