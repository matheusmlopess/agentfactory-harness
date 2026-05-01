# Feature: Wave 3 — DAG Orchestration Engine
<!-- version: 1.0.0 -->

## What it does

Adds a parallel, dependency-aware plan execution engine to `factory`. You
describe a set of agent tasks and their dependencies in an `af-plan.json` file;
the executor runs them at maximum safe concurrency, substitutes earlier step
outputs into later prompts, and cascade-skips anything downstream of a failure.
Three CLI commands (`factory run`, `factory plan new`, `factory plan validate`)
wire the engine into the shell.

---

## Architecture

```
╔═════════════════════════════════════════════════════════════════════════╗
║                  factory — Wave 3 Orchestration Layer                   ║
║                                                                         ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  src/cli.ts                                                      │   ║
║  │  factory run [path]    factory plan new    factory plan validate  │   ║
║  └──────────────────────────────┬─────────────────────────────────┘   ║
║                                  │ af-plan.json (parsed + validated)    ║
║                                  ▼                                      ║
║  ┌──────────────────┐   ┌────────────────────────────────────────────┐  ║
║  │  schema.ts       │   │  graph.ts                                  │  ║
║  │                  │──►│                                            │  ║
║  │  PlanSchema      │   │  toposort()        Kahn's algorithm        │  ║
║  │  StepSchema      │   │  detectCycles()    DFS with path stack     │  ║
║  │  (Zod, strict)   │   │  readySet()        unblocked step filter   │  ║
║  └──────────────────┘   └───────────────────────┬────────────────────┘  ║
║                                                  │                       ║
║                                                  ▼                       ║
║  ┌───────────────────────────────────────────────────────────────────┐   ║
║  │  executor.ts  —  Executor                                         │   ║
║  │                                                                   │   ║
║  │  run(): AsyncIterable<StepEvent>                                  │   ║
║  │    ├── readySet()               which steps are unblocked?        │   ║
║  │    ├── Promise.race(inFlight)   await the first to finish         │   ║
║  │    ├── interpolate()            {{stepId}} token substitution     │   ║
║  │    └── transitiveDependents()   cascade-skip on error (BFS)       │   ║
║  └────────────────────────────┬──────────────────────────────────────┘   ║
║                               │ AgentRunnerFn (injected)                 ║
║                               ▼                                          ║
║  ┌───────────────────────────────────────────────────────────────────┐   ║
║  │  core/agent-loop.ts   (one agentLoop per step)                    │   ║
║  │  core/llm/index.ts    createAdapter(step.provider ?? env default) │   ║
║  └───────────────────────────────────────────────────────────────────┘   ║
╚═════════════════════════════════════════════════════════════════════════╝
```

| Symbol | Meaning |
|--------|---------|
| `╔═╗╚╝║` | Double-line box — top-level layer boundary |
| `┌─┐└┘│` | Single-line box — module or class |
| `──►` | Data or control flow direction |
| `├──` | Component within the same module |
| `▼` | Downward dependency / call chain |

### Key files

| File | Role |
|------|------|
| `src/orchestration/schema.ts` | Zod schema for `af-plan.json` — id regex, duplicate id check, unknown dep ref check |
| `src/orchestration/graph.ts` | Pure graph algorithms: `toposort`, `detectCycles`, `readySet` |
| `src/orchestration/executor.ts` | `Executor` class — event-driven parallel runner |
| `src/orchestration/planner.ts` | `Planner.wizard()` — interactive readline wizard that writes `af-plan.json` |
| `src/core/tools/agent.ts` | `AgentTool` — spawns a child `agentLoop` session, returns trimmed text |
| `src/cli.ts` | CLI commands: `factory run`, `factory plan new`, `factory plan validate` |

---

## How it works

### 1 — Plan schema and validation

A plan is a JSON object. Every field is validated at parse time by Zod before
any execution begins.

```
┌──────────────────────────────────────────────────────────────────────┐
│  af-plan.json  (PlanSchema)                                          │
│                                                                      │
│  {                                                                   │
│    "version": "1.0",                         ← literal, not a semver │
│    "name":    "research-pipeline",                                   │
│    "steps": [                                                        │
│      {                                                               │
│        "id":        "fetch",                 ← /^[a-z0-9_-]+$/      │
│        "agent":     "my-agent",              ← non-empty string      │
│        "prompt":    "Fetch the latest data", ← non-empty string      │
│        "dependsOn": [],                      ← default []            │
│        "timeout":   30000,                   ← ms, optional          │
│        "provider":  "anthropic",             ← optional, overrides env│
│        "model":     "claude-opus-4-7"        ← optional              │
│      },                                                              │
│      ...                                                             │
│    ]                                                                 │
│  }                                                                   │
│                                                                      │
│  superRefine checks (run after field validation):                    │
│    ① duplicate step id  → ZodIssue custom error                     │
│    ② dependsOn ref not found in id set → ZodIssue custom error      │
└──────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `←` | Inline annotation — constraint or default value |
| `①②` | Ordered cross-field checks that run after per-field validation |

**Why `superRefine`?** Zod's per-field validators can only see one field at a
time. Cross-field invariants (duplicate ids, dangling refs) require access to
the whole `steps` array at once, which is what `superRefine` provides.

---

### 2 — Graph algorithms (`graph.ts`)

#### Topological sort — Kahn's algorithm

```
┌────────────────────────────────────────────────────────────────────┐
│  toposort(steps)                                                   │
│                                                                    │
│  1. Build inDegree map:  id → count of dependsOn entries          │
│  2. Build adj map:       dep id → list of dependents               │
│  3. Seed queue with all ids where inDegree == 0   (no deps)       │
│                                                                    │
│  while queue not empty:                                            │
│    id = queue.shift()                                              │
│    result.push(id)                                                 │
│    for each dependent of id:                                       │
│      inDegree[dependent]--                                         │
│      if inDegree[dependent] == 0: queue.push(dependent)           │
│                                                                    │
│  if result.length ≠ steps.length:                                  │
│    → cycle detected → call detectCycles() → throw                 │
└────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `→` | Resulting action or state change |
| `inDegree` | Count of unsatisfied dependencies for a node |
| `adj` | Adjacency list mapping each step to its dependents (reverse edges) |

The `Executor` constructor calls `toposort()` immediately — a plan with a cycle
throws before any agent runs.

#### Cycle detection — DFS with path stack

```
┌────────────────────────────────────────────────────────────────────┐
│  detectCycles(steps)                                               │
│                                                                    │
│  visited = Set     ← globally seen nodes (skip re-entry)          │
│  stack   = Set     ← nodes on the current DFS path                │
│                                                                    │
│  dfs(id, path):                                                    │
│    if id ∈ stack:                                                  │
│      cycle = path.slice(path.indexOf(id))   ← extract the loop    │
│      cycles.push(cycle)                                            │
│      return                                                        │
│    if id ∈ visited: return                                         │
│                                                                    │
│    visited.add(id); stack.add(id); path.push(id)                  │
│    for dep of adj[id]: dfs(dep, path)                              │
│    path.pop(); stack.delete(id)                ← backtrack         │
└────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `∈` | Set membership |
| `← extract the loop` | Slice from first occurrence of the repeated id |
| `← backtrack` | Stack and path are unwound on exit so sibling paths are clean |

#### Ready set

```
┌────────────────────────────────────────────────────────────────────┐
│  readySet(steps, completed)                                        │
│                                                                    │
│  for each step:                                                    │
│    skip if step.id ∈ completed        (already done)              │
│    add if step.dependsOn ⊆ completed  (all deps satisfied)        │
│                                                                    │
│  returns Set<string>  — ids safe to launch right now              │
└────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `⊆` | Subset — every element of `dependsOn` is in `completed` |
| `completed` | Includes both `done` and `skipped` steps (skips are treated as resolved for dependency purposes) |

---

### 3 — Executor event loop

```
┌──────────────────────────────────────────────────────────────────────┐
│  Executor.run()    async generator                                   │
│                                                                      │
│  state:  outputs Map    ← step id → output string                   │
│          completed Set  ← done + skipped                            │
│          failed Set     ← errored                                    │
│          running Set    ← currently in flight                        │
│          emitted Set    ← final event has been yielded               │
│          queue []       ← pending StepEvents to yield               │
│                                                                      │
│  loop while emitted.size < steps.length:                            │
│    ① flush queue      → yield all queued events                    │
│    ② compute skipSet  → transitiveDependents(failed, steps)         │
│    ③ emit skips       → enqueue step:skipped for each new skip      │
│    ④ mark emitted     → add completed + failed to emitted           │
│    ⑤ dispatch ready   → readySet(steps, completed)                  │
│         for each ready id not yet running/emitted:                   │
│           if running.size ≥ maxConcurrency: break                   │
│           launch runStep(step) → push to inFlight[]                 │
│    ⑥ await Promise.race(inFlight)  ← blocks until one finishes     │
│                                                                      │
│  final flush + yield plan:done                                       │
└──────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `①–⑥` | Ordered phases within one iteration of the main loop |
| `← blocks` | Execution suspends here; resumes when the fastest in-flight promise resolves |
| `queue []` | Events are buffered during a step's async execution and drained at phase ① of the next tick |

**Why a queue?** `runStep` is a concurrent async function — it enqueues events
internally (not yields), so multiple steps can fire events at any time. The
outer loop drains the queue on each tick, giving deterministic event ordering
despite concurrency.

#### Template interpolation

```
┌──────────────────────────────────────────────────────────────────┐
│  interpolate(prompt, inputs)                                     │
│                                                                  │
│  regex: /\{\{([a-z0-9_-]+)\}\}/g                                │
│                                                                  │
│  "Analyze {{fetch}} and compare to {{summarize}}"                │
│        │                       │                                 │
│        └─ replaced with        └─ replaced with                  │
│           outputs["fetch"]        outputs["summarize"]           │
│                                                                  │
│  unknown token → replaced with ""  (no error)                   │
└──────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `{{id}}` | Token — step id surrounded by double braces |
| `└─` | Token is replaced in-place by the referenced step's output string |

#### Cascade-skip — `transitiveDependents`

```
┌──────────────────────────────────────────────────────────────────┐
│  transitiveDependents(failedIds, steps)   BFS / fixed-point      │
│                                                                  │
│  result = Set()                                                  │
│  repeat until no new ids added:                                  │
│    for each step not yet in result:                              │
│      if any dep ∈ (failedIds ∪ result):                         │
│        result.add(step.id)   ← mark for skip                    │
│                                                                  │
│  example:  failed = {A}   steps: A→B→C, A→D→E, X               │
│                                                                  │
│  round 1:  B ∈ result (dep A failed)  D ∈ result (dep A failed) │
│  round 2:  C ∈ result (dep B skipped) E ∈ result (dep D skipped)│
│  round 3:  no change → stop                                      │
│                                                                  │
│  result = {B, C, D, E}   X is independent → runs normally       │
└──────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `∈` | Set membership check |
| `∪` | Union — failed OR already-in-skip-set |
| `← mark for skip` | Step will receive `step:skipped` event, not be launched |
| `X` | Independent step — has no ancestor in the failed set, continues unaffected |

---

## Usage

### Scenario walkthroughs

#### Scenario 1 — Linear chain (A → B → C)

```
                 prompt interpolation
                 │
Step A ──done──► Step B ──done──► Step C ──done──► plan:done
  │                │                 │
  │                └── {{a}} in B's prompt replaced with A's output
  │                                  └── {{b}} in C's prompt replaced with B's output
  │
  └── no dependsOn — runs immediately at t=0
```

| Symbol | Meaning |
|--------|---------|
| `──done──►` | Step completed, unlocking the next |
| `└──` | Side effect that occurs at this point |

1. Executor calls `readySet` — only A has no deps; A launches at t=0.
2. A's `agentRunner` resolves → `outputs.set('a', result)` → `completed.add('a')`.
3. Next iteration: `readySet` returns `{b}` — B launches with `{{a}}` replaced.
4. B resolves → C is unblocked → C launches with `{{b}}` replaced.
5. C resolves → `emitted.size == steps.length` → `plan:done` emitted.

---

#### Scenario 2 — Diamond (parallel fan-out, then join)

```
           ┌──► Step B ──┐
Step A ────┤              ├──► Step D ──► plan:done
           └──► Step C ──┘

t=0   A running
t=1   A done  →  B running, C running  (both unblocked simultaneously)
t=2   B done, C done  →  D running     (D needs both)
t=3   D done  →  plan:done
```

| Symbol | Meaning |
|--------|---------|
| `┌──►` `└──►` | Parallel branches forking from A |
| `├──►` | Join point — D waits until both B and C are in `completed` |

1. `readySet` at t=0: `{A}` only (B, C, D all have unmet deps).
2. A completes → `completed = {A}`.
3. `readySet` returns `{B, C}` — both launched concurrently (running.size=2 ≤ maxConcurrency=3).
4. `Promise.race` resolves whichever of B/C finishes first. The other is still running.
5. After both resolve, `completed = {A, B, C}`. `readySet` returns `{D}`.
6. D launches, resolves, `plan:done`.

---

#### Scenario 3 — Cascade-skip on failure

```
Step A ──error──► ╳
                  │
         ┌────────┴────────┐
         ▼                 ▼
      Step B            Step D        ← skipped (depend on A)
         │
         ▼
      Step C                          ← skipped (depends on B)

Step X (independent) ──done──► plan:done
```

| Symbol | Meaning |
|--------|---------|
| `──error──►` | Step terminated with an exception |
| `╳` | Failure node — source of the cascade |
| `▼ skipped` | Transitively dependent step, never launched |
| `Step X` | No dependency on A, B, C, D — runs and completes normally |

1. A throws → `failed.add('A')`, `step:error` enqueued.
2. Next loop iteration: `transitiveDependents({A}, steps)` = `{B, D}` (round 1) + `{C}` (round 2).
3. B, C, D receive `step:skipped` events and are added to `completed` (for `readySet` purposes).
4. X is not in the skip set → `readySet` returns `{X}` → X runs and succeeds.
5. `plan:done` emitted once all 5 steps are in `emitted`.

---

#### Scenario 4 — Concurrency throttle (`maxConcurrency`)

```
maxConcurrency = 2,  steps: A, B, C  (no deps)

t=0   running=[A, B]   C waiting  ← running.size(2) ≥ maxConcurrency(2)
         │
         ▼
t=1   A done  →  running=[B, C]   ← slot freed, C now dispatched
         │
         ▼
t=2   B done, C done  →  plan:done
```

| Symbol | Meaning |
|--------|---------|
| `running.size(N) ≥ maxConcurrency(M)` | Guard that prevents launching more than M concurrent steps |
| `← slot freed` | When a step finishes, the next ready step is dispatched on the following loop iteration |

1. `readySet` returns `{A, B, C}` (no deps on any).
2. The dispatch loop: launches A (`running.size` → 1), launches B (`running.size` → 2), checks C — `running.size(2) ≥ maxConcurrency(2)` → `break`.
3. `Promise.race` resolves when A finishes. `running.size` drops to 1.
4. Next iteration: `readySet` returns `{C}`, C is dispatched.

---

#### Scenario 5 — Per-step LLM provider override

```
af-plan.json:
  step "cheap-draft":  provider="openai",    model="gpt-4o-mini"
  step "final-polish": provider="anthropic", model="claude-opus-4-7"
  step "summary":      (no provider field)   ← uses LLM_PROVIDER env default

                      ┌──────────────────────────────────────────────┐
factory run           │  agentRunner per step                        │
                      │                                              │
  cheap-draft   ──────► createAdapter("openai")    → OpenAIAdapter  │
  final-polish  ──────► createAdapter("anthropic") → AnthropicAdapter│
  summary       ──────► createAdapter(defaultProvider()) → env-driven│
                      └──────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──────►` | Step resolved to a specific adapter instance |
| `← env-driven` | `defaultProvider()` reads `LLM_PROVIDER` env var, falls back to `"anthropic"` |

Each step gets its own `Session` and `agentLoop` invocation. The adapter is
created fresh per step — no shared state between steps.

---

### CLI commands

#### `factory plan new` — interactive wizard

```bash
$ factory plan new

  factory plan new — interactive wizard

  Plan name: research-pipeline

  Step 1
    id (e.g. fetch): fetch-data
    agent name: my-agent
    prompt: Retrieve the latest usage metrics
    dependsOn (comma-separated ids, or blank):

  Step 2
    id (e.g. fetch): analyze
    agent name: my-agent
    prompt: Analyze this data: {{fetch-data}}
    dependsOn (comma-separated ids, or blank): fetch-data

  Add another step? [y/N] n

  Written: /your/cwd/af-plan.json
```

#### `factory plan validate` — schema + cycle check

```bash
# Valid plan:
$ factory plan validate
Plan "research-pipeline" is valid (2 steps)

# Invalid plan — unknown dep ref:
$ factory plan validate bad-plan.json
Invalid plan:
Step "analyze" has unknown dependsOn ref: "nonexistent"

# Cycle:
$ factory plan validate cyclic.json
Error: Plan contains cycles: a → b → a
```

#### `factory run` — execute a plan

```bash
# Set at least one provider key:
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-proj-...
export LLM_PROVIDER=openai

$ factory run
step:start         fetch-data
step:start         summarize
step:done          fetch-data
step:done          summarize
step:start         analyze
step:done          analyze
step:start         write-report
step:done          write-report
plan:done

# Run a named plan file:
$ factory run ./plans/weekly-report.json
```

#### Environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...   # Required when provider=anthropic (or default)
OPENAI_API_KEY=sk-proj-...     # Required when provider=openai
LLM_PROVIDER=openai            # Override default provider (default: anthropic)
```

#### `factory doctor` — verify environment

```bash
$ factory doctor
  ✓  Node.js ≥ 20       v22.1.0
  ✓  ANTHROPIC_API_KEY  set
  ✓  OPENAI_API_KEY     set
  ○  LLM_PROVIDER       not set (default: anthropic)
  ✓  .ai/ harness       present
  ✓  CLAUDE.md          present

  5/6 checks passed
```

---

## Test coverage

### Test files

| File | Tests | What is covered |
|------|-------|-----------------|
| `src/orchestration/schema.test.ts` | 6 | valid plan, duplicate id, unknown dep ref, optional fields, empty steps |
| `src/orchestration/graph.test.ts` | 8 | linear chain toposort, diamond, self-cycle, 3-node cycle, readySet with no completed, readySet partial, cycle throws in toposort |
| `src/orchestration/executor.test.ts` | 9 | single step, parallel fan-out timing, chain order, cascade-skip, independent step survives failure, maxConcurrency=1 serial, interpolation, plan:done last, cycle throws in constructor |
| `src/orchestration/planner.test.ts` | 3 | single step wizard, dependsOn parsing, blank name error |
| `src/core/tools/agent.test.ts` | 3 | text concat, empty output, metadata passthrough |

### Run tests

```bash
$ npm test
# All tests must pass. vitest in watch mode:
$ npm test -- --watch
```

### Not yet tested

- `factory run` CLI end-to-end (requires real API key or a CLI integration harness)
- `Planner.wizard()` overwrite prompt path (requires interactive TTY mock)
- `OrchestrationCanvas.syncFromPlan()` and `applyStepEvent()` (requires CellBuffer test harness)
- Timeout enforcement per step (field exists in schema, not yet wired into `agentRunner`)

---

## Known limitations

- **No timeout enforcement.** `Step.timeout` is validated and stored but `agentRunner` in `cli.ts` does not yet wire `AbortSignal` with a timer. Will be added in a follow-up.
- **No live TUI feedback during `factory run`.** Events are written to stderr as plain text. `OrchestrationCanvas.applyStepEvent()` exists and is ready to consume them — the bridge from `Executor` events to the canvas render loop is Wave 4 scope.
- **`agentRunner` in CLI runs the full agent loop.** Each step spawns a fresh `Session` and `agentLoop`. Multi-turn tool use within a step works, but there is no way to pass tool registrations per-step from the plan file.
- **`factory plan new` wizard is linear.** You can only add steps sequentially. Editing an existing plan requires manual JSON editing or re-running the wizard with overwrite.
- **No retry on step failure.** A failed step cascades immediately. A `retries: N` field is a planned schema extension.
