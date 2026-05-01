# Approved Plan: Wave 3 — DAG Orchestration Engine
<!-- version: 1.0.0 -->
<!-- approved: 2026-05-01 -->

## Goal

Implement the orchestration layer that makes the canvas functional: a Zod-validated
`af-plan.json` schema, a cycle-detecting DAG graph module, an async-iterable executor
that drives steps in topological order (parallel-safe), and an interactive `/plan new`
wizard that writes the plan file. The OrchestrationCanvas built in Wave 2 gains a live
status feed from the executor via `loadState()`.

---

## Scope

| File | Action | Wave |
|------|--------|------|
| `src/orchestration/schema.ts` | implement | 3 |
| `src/orchestration/graph.ts` | implement | 3 |
| `src/orchestration/executor.ts` | implement | 3 |
| `src/orchestration/planner.ts` | implement | 3 |
| `src/core/tools/agent.ts` | implement (AgentTool) | 3 |
| `src/tui/panels/OrchestrationCanvas.ts` | extend (wire executor events → loadState) | 3 |
| `src/cli.ts` | add `/run` and `/plan` subcommands | 3 |

---

## Reference material

The following open-multi-agent files directly informed the design decisions below.
All path references are repo-relative inside `.refs/open-multi-agent/`.

| Decision | Reference |
|----------|-----------|
| Event-driven unblock on dependency complete | `src/task/queue.ts:74–94` |
| `isTaskReady` dependency check (pending + all deps completed) | `src/task/task.ts:76–80` |
| `dependency-first` scheduler / criticality BFS | `src/orchestrator/scheduler.ts:50–75` |
| Coordinator pattern (goal → task DAG via LLM) | `src/orchestrator/orchestrator.ts:34–42` |
| Two independent concurrency semaphores | `.refs/open-multi-agent/CLAUDE.md` Architecture section |

---

## af-plan.json format

```jsonc
{
  "version": "1.0",
  "name": "my-pipeline",
  "steps": [
    {
      "id": "fetch",
      "agent": "web-researcher",
      "prompt": "Fetch the latest Node.js LTS release notes",
      "dependsOn": [],
      "timeout": 60000
    },
    {
      "id": "summarise",
      "agent": "writer",
      "prompt": "Summarise the release notes fetched by {{fetch}}",
      "dependsOn": ["fetch"]
    }
  ]
}
```

Rules enforced by Zod schema:
- `version`: literal `"1.0"`
- `name`: non-empty string
- `steps`: array ≥ 1 element, each step has unique `id`
- `id`: `/^[a-z0-9-_]+$/` (no spaces, no slashes)
- `dependsOn`: string array, all ids must reference other steps in the same plan
- `prompt`: non-empty string; may contain `{{stepId}}` interpolation tokens
- `timeout`: optional positive integer (ms), default `120_000`

---

## Public types

```typescript
// schema.ts
export const StepSchema: z.ZodObject<...>
export const PlanSchema: z.ZodObject<...>
export type Step = z.infer<typeof StepSchema>
export type Plan = z.infer<typeof PlanSchema>

// graph.ts
export function toposort(steps: Step[]): string[]          // throws on cycle
export function detectCycles(steps: Step[]): string[][]    // returns cycle arrays, empty if none
export function readySet(steps: Step[], completed: Set<string>): Set<string>

// executor.ts
export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'
export interface StepEvent {
  type: 'step:start' | 'step:done' | 'step:error' | 'step:skipped' | 'plan:done'
  stepId: string
  status: StepStatus
  output?: string
  error?: string
  durationMs?: number
}
export class Executor {
  constructor(plan: Plan, opts: ExecutorOptions)
  run(): AsyncIterable<StepEvent>
}
export interface ExecutorOptions {
  maxConcurrency?: number          // default 3
  agentRunner: AgentRunnerFn       // injected; wraps agentLoop
}
export type AgentRunnerFn = (step: Step, inputs: Record<string, string>) => Promise<string>

// planner.ts
export class Planner {
  constructor(session: Session)
  wizard(): Promise<Plan>          // interactive; writes af-plan.json to cwd
}
```

---

## Execution model

```
toposort(plan.steps) → layered sets of independent steps
                          │
              ┌───────────▼────────────┐
              │    readySet(steps,     │  ← re-evaluated after each step completes
              │    completed)          │
              └───────────┬────────────┘
                          │ (up to maxConcurrency steps)
              ┌───────────▼────────────┐
              │   agentRunner(step,    │  ← runs agentLoop internally
              │   interpolated prompt) │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  StepEvent yielded     │  → OrchestrationCanvas.loadState()
              │  completed.add(stepId) │
              └────────────────────────┘
```

Key invariants:
1. A step is dispatched only when **all** `dependsOn` ids are in `completed`.
2. If a step errors, all steps that (transitively) depend on it are emitted as
   `step:skipped` — the rest of the plan continues.
3. `plan:done` is emitted after all steps resolve (done, error, or skipped).
4. `Promise.allSettled` is used for concurrent batches so one failure does not
   throw away sibling results.

Prompt interpolation: `{{stepId}}` tokens in a step's `prompt` are replaced with
the trimmed `output` of the named completed step before `agentRunner` is called.

---

## AgentTool (core/tools/agent.ts)

Wave 3 implements `AgentTool` — the previously-planned stub. It spawns a child
`agentLoop` session, passes the `prompt` string as the first user message, and
returns the final assistant text as the tool result. The executor's `agentRunner`
function wraps this tool.

```typescript
export const AgentTool: Tool = {
  name: 'agent',
  description: 'Run a sub-agent with the given prompt and return its output',
  inputSchema: z.object({
    prompt: z.string(),
    model: z.string().optional(),
  }),
  async execute({ prompt, model }): Promise<string> { ... }
}
```

---

## Canvas integration

`OrchestrationCanvas` already exposes `loadState(state: CanvasState)`. Wave 3 adds
`syncFromPlan(plan: Plan)` (converts `Plan.steps` to `Block[]` preserving wired
`dependsOn` edges as `CanvasWire[]`) and `applyStepEvent(event: StepEvent)` (maps
`StepStatus` → `Block.status`).

The `App` class subscribes to executor `StepEvent`s and calls
`canvas.applyStepEvent(e)` on each tick, triggering a re-render via the existing
render loop.

---

## CLI additions

```
factory run [plan-path]    ← loads af-plan.json (default cwd), runs executor,
                             streams StepEvents to stderr + canvas
factory plan new           ← launches Planner wizard, writes af-plan.json
factory plan validate      ← parses plan, detects cycles, exits 0/1
```

Commander commands wired in `src/cli.ts`. All three are synchronous entry points that
construct the necessary objects and call `executor.run()` or `planner.wizard()`.

---

## Test targets

| File | Scenarios | Min coverage |
|------|-----------|--------------|
| `src/orchestration/schema.test.ts` | valid plan round-trips, missing id, duplicate id, invalid dependsOn ref, bad timeout | 100% schema paths |
| `src/orchestration/graph.test.ts` | linear chain, diamond DAG, self-cycle, 3-node cycle, empty plan, isolated nodes | 100% |
| `src/orchestration/executor.test.ts` | single step, parallel fan-out, dependency chain, error cascades (skip dependents), maxConcurrency=1 serial, prompt interpolation, plan:done emitted last | 100% |
| `src/orchestration/planner.test.ts` | wizard writes valid plan file, file overwrite prompt, Zod parse of written output | ≥ 80% |
| `src/core/tools/agent.test.ts` | AgentTool returns runner output, propagates errors | ≥ 80% |

Test harness: vitest with fake `agentRunner` stub (returns `Promise.resolve('ok')`)
so executor tests run without live API calls.

---

## Project-index updates

Flip `status: planned → implemented` for all 4 orchestration entries plus `agent.ts`.
Add new test files. Bump `meta.wave: 2 → 3` and `meta.version: "1.2.0" → "1.3.0"`.

---

## Release

- Branch: `feature/wave-3-orchestration`
- PR title: `feat: Wave 3 — DAG orchestration engine, executor, /run, /plan`
- Tag: `v0.4.0`
