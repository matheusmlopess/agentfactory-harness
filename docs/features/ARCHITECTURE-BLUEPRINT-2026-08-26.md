# Architecture Blueprint — Compartmentalized `factory`

<!-- version: 1.1.0 -->
<!-- classification: ARCHITECTURE -->
<!-- date: 2026-08-26 -->
<!-- last-updated: 2026-08-26 -->

The living blueprint for the block architecture: what each block takes in and puts out, which
surfaces are stable connectors (backward-compat-governed) versus free-to-change internals, and
the diagrams that back the design. Plan of record:
`specs/docs/approvedPlans/2026-08-26-compartmentalize-blocks.md`. Boundaries are enforced by
each package's `dependencies` + `eslint.config.js` (`.ai/rules/module-boundaries.md`).

**Status:** Stages A–E implemented. The platform blocks — **contracts, core, shared,
orchestration, registry** — are now `@factory/*` npm **workspace packages** under `packages/*`;
the app **host + the six features** stay in `src/`. Runtime feature toggles + contract
versioning (Stage E) are live. Remaining follow-up: per-feature packages + `node-pty` in its
own package, and tsc project-references for machine-checked cross-package types (see §8).

---

## 1. The parts manual — every block's I/O contract

Legend: **In** = what it consumes · **Out** = its public API · **Connector** = the stable
interface others bind to (breaking it = major bump + consumer adaptation) · **Internal** = free
to change with zero external impact · **Ripple** = changing the *connector* forces these to adapt.

```
┌─ contracts/ ─────────────────────────────────────────── (the bolt-spec; leaf-ward) ─┐
│ In       : orchestration + core + shared TYPES only (import type; erased)            │
│ Out      : Feature, FeatureCtx, ServiceMap, ServiceRegistry, SessionBridge,          │
│            PlanBridge, PlanEventSink, SessionMeta, SessionStats, createServiceRegistry│
│ Connector: ALL of Out — this IS the contract surface. Highest stability bar.         │
│ Internal : createServiceRegistry impl (a Map behind the typed interface)             │
│ Ripple   : a breaking change here ⇒ EVERY feature + host adapt (Stage-E version gate │
│            will reject features not rebuilt against the new major).                   │
├─ orchestration/ ────────────────────────────────── (pure engine; the true leaf) ────┤
│ In       : zod + node only. NOTHING from shared/core/features.                       │
│ Out      : PlanSchema, Plan, Step, Executor, StepEvent, graph utils, studio-model    │
│ Connector: PlanSchema (+ x-studio), StepEvent, Executor.run, studioToPlan/planToStudio│
│ Internal : executor scheduling, graph algorithms, validation messages                │
│ Ripple   : StepEvent ⇒ canvas.applyStepEvent + agents.onPlanEvent; Plan ⇒ round-trip │
├─ core/ ───────────────────────────────── (services: llm, config, tools, logger) ────┤
│ In       : contracts TYPES, @anthropic-ai/sdk, openai, zod, node                     │
│ Out      : agentLoop, Session, ConfigStore, providers, llm adapters, Tool, logger …  │
│ Connector: ConfigStore/getSetting, Tool, agentLoop, ModelEntry, LLMAdapter           │
│ Internal : provider HTTP, token accounting, rollout format, log format               │
│ Ripple   : ConfigStore ⇒ shared(settings/motion/size) + config feature; agentLoop ⇒  │
│            session/canvas/logs run paths                                              │
├─ shared/ ─────────────────────────────────── (platform: render + input + widgets) ──┤
│ In       : contracts TYPES  [+ core/config in 4 files — tracked soft spot]           │
│ Out      : CellBuffer, layout, theme, Overlay, ScrollableList, ContextMenu, Palette, │
│            HelpOverlay, StatusBar, Panel, TabEntry, InputController, Keymap, Router   │
│ Connector: Panel (render/onKey/onMouse), TabEntry, KeyBindingDef, PaletteCommand     │
│ Internal : ANSI emission, diff algorithm, widget pixel layout, theme values          │
│ Ripple   : Panel/TabEntry/KeyBindingDef ⇒ every feature panel; a widget internal ⇒ nobody│
├─ feature-<x>/ (session·canvas·agents·terminal·config·logs) ── (bolt-on parts) ───────┤
│ In       : contracts, shared, core, orchestration (+ node-pty ONLY in terminal;      │
│            + registry in config/harness for auth)                                    │
│ Out      : one factory xFeature(): Feature                                           │
│ Connector: the Feature it returns + any ServiceMap key it PROVIDES                   │
│ Internal : its Panel, private state, flows, helpers, tests                           │
│ Ripple   : changing a PROVIDED bridge ⇒ contracts + consumers; internals only ⇒ NOBODY│
├─ host/ (app.ts + cli + index + registry + harness) ───────── (the chassis) ──────────┤
│ In       : EVERYTHING · Out : the factory bin (nothing imports host)                 │
│ Connector: builds the FeatureCtx + ServiceRegistry it injects                        │
│ Ripple   : FeatureCtx ⇒ contracts bump ⇒ all features; render/CLI ⇒ nobody           │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Backward-compatibility policy

- **STABLE** = anything a block exports as a *Connector* (above). Changing it is breaking:
  bump the major, update every consumer in the same PR, run the contract tests. ESLint
  guarantees only the barrel/connector is reachable, so the compat surface has nothing hidden.
- **INTERNAL** = anything not in the connector list → change freely; the build proves no one
  depends on it.
- **ADDITIVE** = a new optional field, a new `ServiceMap` key, a new feature → never breaks
  consumers. This is the pattern of `x-studio` and the lazy/optional `.get()` seams.

---

## 2. Software architecture — current (implemented)

```mermaid
graph TD
    subgraph host["host chassis - factory bin"]
        APP["app.ts registry render loop"]
        CLI["cli.ts run plan doctor"]
    end
    subgraph features["features - never import each other"]
        SES["session"]
        CVS["canvas"]
        AGT["agents"]
        TRM["terminal plus node-pty"]
        CFG["config"]
        LOG["logs"]
    end
    CON["contracts - Feature ServiceMap bridges"]
    SHA["shared - renderer input widgets"]
    COR["core - agent-loop llm config tools"]
    ORC["orchestration - schema executor studio-model PURE"]
    REG["registry - auth client login"]
    host --> features
    host --> CON
    host --> SHA
    host --> COR
    host --> ORC
    host --> REG
    features --> CON
    features --> SHA
    features --> COR
    features --> ORC
    SHA --> CON
    SHA --> COR
    COR --> CON
    CON --> ORC
    CON --> COR
    REG --> COR
```

Stage D turns each node into an `@factory/*` workspace package; the edges above become the
package `dependencies` DAG (acyclic). `node-pty` stays inside `feature-terminal` only.

---

## 3. Communication diagrams

### 3a. Boot — feature registration and typed service wiring

```mermaid
sequenceDiagram
    participant Host as app_ts
    participant Reg as FeatureRegistry
    participant Feat as FeaturePanel
    participant Svc as ServiceRegistry
    Host->>Reg: registerFeature for each of six
    Host->>Feat: makePanel ctx lazy on first render
    Feat->>Svc: set session or plan or plan-events
    Note over Svc: typed by ServiceMap - no casts
    Note over Host: Stage E adds enable-disable and version gate here
```

### 3b. Runtime — a plan run fans events across blocks

```mermaid
sequenceDiagram
    participant U as Operator
    participant CVS as canvas
    participant M as studio_model
    participant EX as Executor
    participant Svc as ServiceRegistry
    participant AGT as agents
    U->>CVS: Ctrl R run
    CVS->>M: validateStudio model
    CVS->>M: studioToPlan model to Plan
    CVS->>Svc: get plan-events
    Svc-->>CVS: PlanEventSink or undefined
    CVS->>AGT: setPlan when present else no-op
    CVS->>EX: run
    loop each StepEvent
        EX-->>CVS: applyStepEvent status glyphs
        CVS->>AGT: onPlanEvent rows and log
    end
```

### 3c. Input dispatch — host to shared to the active feature panel

```mermaid
sequenceDiagram
    participant TTY as stdin
    participant IC as InputController
    participant KM as Keymap
    participant RT as InputRouter
    participant P as ActivePanel
    TTY->>IC: bytes
    alt terminal tab
        IC->>P: raw bypass to PTY
    else palette or help open
        IC->>IC: modal consumes
    else
        IC->>KM: match key activeTab textInput
        alt binding not panelFirst
            KM-->>IC: run
        else
            IC->>RT: dispatch key or mouse
            RT->>P: onKey or onMouse
        end
    end
```

---

## 4. Data model — ERD

```mermaid
erDiagram
    PLAN ||--o{ STEP : contains
    PLAN ||--o| XSTUDIO : extends
    STUDIOMODEL ||--o{ STUDIONODE : nodes
    STUDIOMODEL ||--o{ STUDIOEDGE : edges
    STUDIONODE }o--o| SESSIONRECORD : binds
    STEP ||--o{ STEPEVENT : emits
    CONFIGFILE ||--o{ SETTING : settings
    SESSIONRECORD ||--|| SESSIONMETA : projects
    SERVICEMAP ||--|| SESSIONBRIDGE : keySession
    SERVICEMAP ||--|| PLANBRIDGE : keyPlan
    SERVICEMAP ||--|| PLANEVENTSINK : keyPlanEvents
    FEATURE ||--|| FEATUREMANIFEST : declares
    PLAN {
      string version
      string name
    }
    STEP {
      string id
      string agent
      string prompt
    }
    STUDIONODE {
      string id
      string agent
      string sessionId
    }
    STUDIOEDGE {
      string from
      string to
      string kind
    }
    STEPEVENT {
      string type
      string stepId
      string status
    }
    SESSIONMETA {
      string id
      string name
      string status
    }
    FEATUREMANIFEST {
      string id
      string contract
    }
```

`FEATUREMANIFEST` is the Stage-E manifest (live). `XSTUDIO` is the additive `x-studio`
extension on the plan file that carries canvas layout, typed edges, and node-session bindings.

---

## 5. Contract map — who provides and consumes each service key

```mermaid
graph LR
    SES["session"] -->|provides| K1["key session - SessionBridge"]
    CVS["canvas"] -->|provides| K2["key plan - PlanBridge"]
    AGT["agents"] -->|provides| K3["key plan-events - PlanEventSink"]
    K1 -->|consumed| HOST["host"]
    K1 -->|consumed| AGT
    K1 -->|consumed| CVS
    K2 -->|consumed| HOST
    K3 -->|consumed| CVS
```

This is the entire cross-feature surface — three keys, every edge optional and lazy. Any
provider can be absent (toggled off, Stage E) and consumers degrade to a no-op or fallback.

---

## 6. Enforcement (post-packaging)

Two complementary mechanisms:

1. **Package `dependencies`** (the platform libraries). Each `@factory/*` package declares
   exactly what it may use — the DAG is `orchestration` (leaf) · `core` (leaf) · `shared → core`
   · `contracts → {orchestration, core, shared}` · `registry → core`. A package's public
   surface is its `exports` map; consumers bind to `@factory/x/...`.
2. **ESLint boundaries** (the `src/` app: host + features). The one rule that lives here is the
   guarantee that **a feature never imports a sibling feature** (cross-feature capability goes
   through the typed `ServiceRegistry` in `@factory/contracts`), plus features never importing
   the host/harness. A violation fails `npm run lint` and CI.

Verified: a planted `logs → session` import and a planted `feature → host` import both fail
`npm run lint`; the clean tree passes.

---

## 7. Test blueprint — "test everything"

```
┌ Layer ─────────────┬ Proves ───────────────────────┬ Where / gate ─────────────────┐
│ Boundary lint      │ no block reaches a neighbour;  │ eslint boundaries — CI lint   │
│                    │ no feature→feature import      │ job FAILS on breach           │
│ Contract tests     │ ServiceRegistry set/get/dedup; │ src/contracts/services.test.ts│
│                    │ a provider satisfies its key   │ (extend per key)              │
│ Purity test        │ studio-model imports nothing   │ studio-model.test (grep)      │
│                    │ from shared/features           │                               │
│ Unit per block     │ block internals in isolation   │ vitest run --project <block>  │
│ Integration        │ host loads features, routes    │ controller/app tests via      │
│                    │ input, wires services          │ handleData byte drives        │
│ Event-flow         │ plan run fans to canvas+agents │ canvas/agents with stub Exec  │
│ Round-trip         │ studioToPlan∘planToStudio ≡ id │ studio-model.test             │
│ Version-gate (E)   │ incompatible manifest skipped  │ contracts manifest.test       │
│ Toggle (E)         │ features.<id>=off degrades ok  │ manifest.test + e2e tmux      │
│ E2E smoke          │ real TUI renders + studio run  │ scripts/smoke-tui.sh (tmux)   │
│ Build             │ tsup bundles the workspace, bin │ npm run build                 │
└────────────────────┴────────────────────────────────┴───────────────────────────────┘
```

Gate summary today: `npm run lint` (eslint boundaries + typecheck) · `npm test` (453; per-block
projects incl. `--project orchestration`) · `npm run build` (tsup bundles the `@factory/*`
graph into the `factory` bin) · `scripts/smoke-tui.sh`. A connector change additionally
requires its contract test plus all consumers updated in the same PR.

---

## 8. Roadmap (remaining)

- **Per-feature packages** — split `src/features/*` into `@factory/feature-*` packages so each
  versions independently and `node-pty` lives only in `@factory/feature-terminal` (a subset
  build then omits the native dep). Needs per-package tsconfig `references` to preserve the
  feature-sibling ban that ESLint gives today in `src/`.
- **tsc project references** (`composite` + `tsc -b`) across packages, for machine-checked
  cross-package types and incremental builds — the precise blast-radius guarantee.
- **`shared → core/config` clean-up** (B.3-clean) so `@factory/shared` drops its `@factory/core`
  dependency (StatusBar version via prop; motion/settings/size-profiles take a `ConfigReader`).
- **`factory doctor --features`** capability report (enabled/disabled + provides/consumes).
