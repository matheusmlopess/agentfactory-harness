# PLAN-CORE — Core Integration Seam

<!-- version: 1.0.0 -->
<!-- feature: src/core/tools/{index,context,factory}.ts, src/core/agent-loop.ts, src/orchestration/run-agent.ts, src/core/llm/{types,index}.ts -->
<!-- depends-on: none -->
<!-- BLOCKS: every other multi-agent plan (00–12) -->
<!-- wave: 6A (FIRST) -->

## 1. Overview & Purpose

The feature specs (PLAN-00…12) assume core abstractions that **do not exist today**. This
spec builds that missing seam, backward-compatibly, so the rest can be implemented. It is the
**hard prerequisite** for Wave 6. Source of truth: the §III.A gap audit in the master plan.

Eight changes. Every one preserves existing single-session behaviour (existing tools and the
existing `agentLoop` keep working unchanged).

## 2. Codebase Reality (what exists vs. what we add)

| Assumed by specs | Real today (file:line) | This plan adds |
|---|---|---|
| `buildTool({...})` | absent — plain `Tool<I,O>` literals (`tools/index.ts:9`) | `buildTool()` factory |
| `ToolUseContext` | absent — `run(input)` only | `ToolUseContext` + optional 2nd arg |
| tool `call(input,ctx)` | `run(input): Promise<O>` (`index.ts`) | widen `run(input, ctx?)` |
| `runAgentLoop(...)→string` | only `agentLoop(): AsyncIterable<AgentEvent>` (`agent-loop.ts:35`) | `runAgentLoop()` wrapper |
| `HookResult.additionalContext` | `HookResult = {continue}` (`hooks.ts:15`); shell hooks, no return data | `additionalContext` option on agentLoop (re-home) |
| `getAdapter(provider:string)` | `createAdapter(provider: Provider)`, `Provider='anthropic'\|'openai'` (`llm/index.ts:12`,`types.ts:3`) | widen `Provider`, add `getAdapter` |
| `session.getTokenUsage()` | `Session.tokenCount()`; usage in `AgentEvent 'stats'` | surface via `runAgentLoop` return |
| signal in tools | none | `ctx.signal` |
| per-agent tool allowlist | global `listTools()` only (`agent-loop.ts:49`) | `opts.tools` subset |
| inbox "before each turn" | no per-turn hook | `opts.onBeforeTurn` |

## 3. Interface Definitions

### 3.1 ToolUseContext (`src/core/tools/context.ts`)

```typescript
import type { MessageBus } from '../team/message-bus.js'
import type { SharedMemory } from '../team/shared-memory.js'
import type { AskBroker } from '../team/ask-broker.js'
import type { AgentPool } from '../team/agent-pool.js'
import type { MemoryManager } from '../memory/manager.js'

export interface ToolUseContext {
  agentName?:     string
  signal?:        AbortSignal
  bus?:           MessageBus
  memory?:        SharedMemory
  broker?:        AskBroker
  pool?:          AgentPool
  memoryManager?: MemoryManager
}
```
All fields optional → single-session tools (bash/read/write) ignore ctx; team tools read it.

### 3.2 Tool interface v2 (`src/core/tools/index.ts`)

```typescript
export interface Tool<I = unknown, O = unknown> {
  name: string
  description: string
  inputSchema: z.ZodSchema<I>
  inputSchemaJson: InputSchemaJson
  run(input: I, ctx?: ToolUseContext): Promise<O>     // ← ctx added (optional)
  concurrent?: boolean
}
```
Existing tools (`run({command})`) remain valid — TS allows ignoring the optional 2nd param.

### 3.3 dispatch v2 (`src/core/tools/index.ts:32`)

```typescript
export async function dispatch(name: string, rawInput: unknown, ctx?: ToolUseContext): Promise<string> {
  const tool = getTool(name)
  if (!tool) return `Error: unknown tool '${name}'`
  const parsed = tool.inputSchema.safeParse(rawInput)
  if (!parsed.success) return `Error: invalid input — ${formatZodError(parsed.error)}`
  try {
    const out = await tool.run(parsed.data, ctx)            // ← forward ctx
    return typeof out === 'string' ? out : JSON.stringify(out)
  } catch (err) { return `Error: ${(err as Error).message}` }
}
```

### 3.4 buildTool factory (`src/core/tools/factory.ts`)

```typescript
import { zodToInputSchemaJson } from './schema-json.js'   // small zod→JSON-schema helper

export interface ToolDefInput<I, O> {
  name: string
  description: string
  inputSchema: z.ZodSchema<I>
  run(input: I, ctx?: ToolUseContext): Promise<O>
  concurrent?: boolean
}
export function buildTool<I, O>(def: ToolDefInput<I, O>): Tool<I, O> {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    inputSchemaJson: zodToInputSchemaJson(def.inputSchema),   // derive, don't hand-write
    run: def.run,
    concurrent: def.concurrent ?? false,
  }
}
```
> Note: specs that wrote `inputSchema: { type:'object', properties… }` (raw JSON) switch to a
> Zod schema passed to `buildTool`, which derives `inputSchemaJson`. `zodToInputSchemaJson`
> handles the small subset used (object of string/array/enum).

### 3.5 runAgentLoop wrapper (`src/orchestration/run-agent.ts`)

```typescript
import { agentLoop } from '../core/agent-loop.js'
import { Session } from '../core/session.js'
import type { Tool } from '../core/tools/index.js'
import type { ToolUseContext } from '../core/tools/context.js'
import type { LLMAdapter } from '../core/llm/types.js'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

export interface TokenUsage { input: number; output: number }
export interface RunAgentOptions {
  adapter:          LLMAdapter
  systemPrompt:     string
  initialMessages?: MessageParam[]
  additionalContext?: string                 // prepended to systemPrompt (re-homed injection)
  tools?:           Tool[]                    // per-agent allowlist (default: global registry)
  maxTurns?:        number
  signal?:          AbortSignal
  ctx?:             ToolUseContext
  onBeforeTurn?:    (session: Session) => MessageParam | null
}

export async function runAgentLoop(
  session: Session, opts: RunAgentOptions,
): Promise<{ output: string; tokens: TokenUsage }> {
  for (const m of opts.initialMessages ?? []) session.addMessage(m)
  let output = ''
  const tokens: TokenUsage = { input: 0, output: 0 }
  const systemPrompt = opts.additionalContext
    ? `${opts.additionalContext}\n\n---\n\n${opts.systemPrompt}`
    : opts.systemPrompt
  for await (const ev of agentLoop(session, {
    adapter: opts.adapter, systemPrompt, maxTurns: opts.maxTurns,
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.ctx ? { ctx: opts.ctx } : {}),
    ...(opts.onBeforeTurn ? { onBeforeTurn: opts.onBeforeTurn } : {}),
  })) {
    if (ev.type === 'text_delta') output += ev.delta
    else if (ev.type === 'stats') { tokens.input += ev.inputTokens; tokens.output += ev.outputTokens }
    else if (ev.type === 'error') throw ev.error
  }
  return { output: output.trim(), tokens }
}
```

### 3.6 agent-loop additions (`src/core/agent-loop.ts`)

Extend `AgentLoopOptions`:
```typescript
export interface AgentLoopOptions {
  maxTurns?: number; model?: string; signal?: AbortSignal
  systemPrompt?: string; adapter?: LLMAdapter; noTools?: boolean
  // NEW:
  tools?: Tool[]                               // subset; default listTools()
  ctx?: ToolUseContext                         // forwarded to dispatch()
  onBeforeTurn?: (session: Session) => MessageParam | null
}
```
Implementation deltas inside `agentLoop`:
- Build `toolDefs` from `opts.tools ?? listTools()`.
- Before each turn (top of the per-turn loop): `const m = opts.onBeforeTurn?.(session); if (m) session.addMessage(m)`.
- Tool dispatch site (`:142`): `await dispatch(block.name, parsedInput, opts.ctx)`.
- `systemPrompt` already supported; `additionalContext` is applied by `runAgentLoop` (caller),
  so agentLoop itself needs no change for it.

### 3.7 Provider widening + getAdapter (`src/core/llm/types.ts`, `index.ts`)

```typescript
// types.ts
export type Provider = 'anthropic' | 'openai' | (string & {})   // keep autocomplete, allow any
```
```typescript
// index.ts
export function getAdapter(provider: string, apiKey?: string): LLMAdapter {
  switch (provider) {
    case 'anthropic': return new AnthropicAdapter(apiKey ?? store.getKey('anthropic'))
    case 'openai':    return new OpenAIAdapter(apiKey ?? store.getKey('openai'))
    default:          return new OpenAICompatAdapter(provider, apiKey)   // PLAN-03
  }
}
export const createAdapter = getAdapter   // back-compat alias
```

### 3.8 Re-homed context injection (fixes G5)

The shell-hook `additionalContext` channel does **not** exist. Instead the **TeamExecutor**
assembles the merged context per agent and passes it to `runAgentLoop({ additionalContext })`:
```typescript
const additionalContext = [
  await memoryManager.inject(node.prompt),   // PLAN-12 Layers 3+2
  sharedMemory.getSummary(),                 // PLAN-05 Layer 1
].filter(Boolean).join('\n\n')
```
This **supersedes** PLAN-05 §5 and PLAN-12 §9 (those reference a SessionStart hook return
value that cannot exist). Inbox delivery uses `onBeforeTurn` (PLAN-04 §O), not a hook.

## 4. Mermaid — how the seam threads through one agent run

```mermaid
sequenceDiagram
    participant TE as TeamExecutor
    participant RA as runAgentLoop
    participant AL as agentLoop (generator)
    participant D as dispatch
    participant T as team tool (ctx-aware)
    TE->>RA: {adapter, systemPrompt, additionalContext, tools, ctx, onBeforeTurn, signal}
    RA->>RA: seed session w/ initialMessages; prepend additionalContext
    RA->>AL: agentLoop(session, {tools, ctx, onBeforeTurn, signal})
    loop each turn
        AL->>AL: onBeforeTurn(session) → maybe inject inbox msg
        AL->>D: dispatch(name, input, ctx)
        D->>T: run(input, ctx)  (ctx.bus/memory/broker available)
        T-->>AL: result
    end
    AL-->>RA: text_delta… + stats
    RA-->>TE: { output, tokens }
```

## 5. Edge Cases

| Case | Handling |
|---|---|
| existing tool ignores ctx | optional 2nd param — no change needed |
| `opts.tools` empty array | send no tools (plain chat) |
| onBeforeTurn returns null | nothing injected |
| compat provider with no key | getAdapter → OpenAICompatAdapter resolves via ConfigStore/env (PLAN-03) |
| signal already aborted at entry | agentLoop returns immediately (existing `:62` guard) |

## 6. Test Cases

```
core-tools.test.ts: existing run(input) still works; ctx-aware run reads ctx.bus;
  dispatch forwards ctx; buildTool derives inputSchemaJson from zod
run-agent.test.ts: seeds initialMessages; concatenates text_delta into output;
  sums stats into tokens; additionalContext prepended to systemPrompt;
  onBeforeTurn injects between turns; signal abort propagates
llm-adapter.test.ts: getAdapter('anthropic'|'openai'|'deepseek'); Provider accepts arbitrary string;
  createAdapter alias === getAdapter
```

## 7. Definition of Done

- [ ] `npm test` green incl. existing tool/agent-loop tests (no regression)
- [ ] A ctx-aware tool can call `ctx.bus.send(...)` end-to-end
- [ ] `runAgentLoop` returns `{output, tokens}` for a 2-turn mock session
- [ ] `getAdapter('deepseek')` returns an `OpenAICompatAdapter` (once PLAN-03 lands)
- [ ] `onBeforeTurn` + `additionalContext` both observably affect the sent messages
- [ ] No `any`; explicit return types on public fns
