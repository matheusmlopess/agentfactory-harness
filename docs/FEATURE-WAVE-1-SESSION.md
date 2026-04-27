# Feature: Wave 1 — Session + Agent Loop
<!-- version: 1.0.0 -->

## What it does

Wires the Anthropic Claude API into the `factory` TUI. An async generator agent
loop streams Claude responses turn-by-turn, dispatches tool calls, and surfaces
all events to the `SessionPanel` for live rendering. Wave 1 also registers four
built-in tools (Bash, Read, Write, WebFetch) and a lifecycle hook system.

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                     factory — Wave 1 layers                         ║
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │  src/app.ts   — registers tools, wires SessionPanel         │    ║
║  └────────┬───────────────────────┬───────────────────────────┘    ║
║           │                       │                                  ║
║           ▼                       ▼                                  ║
║  ┌─────────────────┐   ┌───────────────────────────────────────┐    ║
║  │  TUI Layer      │   │  Core Layer                           │    ║
║  │                 │   │                                       │    ║
║  │ SessionPanel.ts │◄──│ agent-loop.ts  (async generator)      │    ║
║  │   ┌─────────┐   │   │ session.ts     (history + tokens)     │    ║
║  │   │scrollbk │   │   │ hooks.ts       (shell hook runner)    │    ║
║  │   │input bar│   │   │ tools/index.ts (registry + dispatch)  │    ║
║  │   └─────────┘   │   │ tools/bash.ts  BashTool               │    ║
║  │                 │   │ tools/read.ts  ReadTool                │    ║
║  │ AgentsPanel.ts  │   │ tools/write.ts WriteTool               │    ║
║  └─────────────────┘   │ tools/web-fetch.ts WebFetchTool        │    ║
║                         └───────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════╝
```

| Symbol | Meaning |
|--------|---------|
| `╔═╗╚╝║` | Double-line box — top-level binary / layer boundary |
| `┌─┐└┘│` | Single-line box — module or class |
| `◄──` | Data flow direction |
| `▼` | Downward control flow |

### Key files

| File | Role |
|------|------|
| `src/core/agent-loop.ts` | `async function* agentLoop(...)` — streaming Claude loop |
| `src/core/session.ts` | `Session` class — history, tokenCount, clear |
| `src/core/hooks.ts` | `runHook(event, ctx)` — shell hook runner |
| `src/core/tools/index.ts` | Tool registry: `registerTool`, `dispatch`, `listTools` |
| `src/core/tools/bash.ts` | `BashTool` — exec with timeout |
| `src/core/tools/read.ts` | `ReadTool` — fs.readFile |
| `src/core/tools/write.ts` | `WriteTool` — fs.writeFile |
| `src/core/tools/web-fetch.ts` | `WebFetchTool` — fetch + text |
| `src/tui/panels/SessionPanel.ts` | Chat panel — scrollback + input bar |
| `src/tui/panels/AgentsPanel.ts` | Agent list sidebar — status badges |

---

## How it works

### Agent loop: streaming and accumulation

```
┌─────────────────────────────────────────────────────────────────────┐
│  agentLoop(session, opts)    async function* generator              │
│                                                                     │
│  while (turns < maxTurns && !signal.aborted)                       │
│  │                                                                  │
│  ├── client.messages.create({ stream: true })                      │
│  │      │                                                           │
│  │      │  content_block_start (tool_use)                          │
│  │      │    → yield { type: 'tool_start', name, id }              │
│  │      │                                                           │
│  │      │  content_block_delta (text_delta)                        │
│  │      │    → textAccum += text                                    │
│  │      │    → yield { type: 'text_delta', delta }                 │
│  │      │                                                           │
│  │      │  content_block_delta (input_json_delta)                  │
│  │      │    → block.inputAccum += partial_json    ← accumulate    │
│  │      │      (NOT parsed until content_block_stop)               │
│  │      │                                                           │
│  │      │  content_block_stop                                      │
│  │      │    → JSON.parse(block.inputAccum)   ← parse once        │
│  │      │    → dispatch(block.name, parsedInput)                    │
│  │      │    → yield { type: 'tool_result', id, content }         │
│  │      │                                                           │
│  │      └── message_delta → stopReason                             │
│  │                                                                  │
│  ├── session.addMessage({ role: 'assistant', content: [...] })     │
│  ├── yield { type: 'turn_end', stop_reason }                       │
│  │                                                                  │
│  ├── if stop_reason == 'end_turn' → break                          │
│  └── else: add tool_results, turns++, loop                         │
└─────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `├──` | Sequential step in the loop body |
| `└──` | Final step / exit |
| `→ yield` | Generator yield point — caller receives event |
| `← accumulate / ← parse once` | The two-phase delta accumulation pattern |

**Why accumulate deltas?** The API sends `input_json_delta` events with raw JSON
*fragments* — each chunk is not valid JSON on its own. Attempting to parse each delta
would throw on every event. The correct pattern: accumulate all `partial_json` strings
into one buffer per tool block, then call `JSON.parse` exactly once at `content_block_stop`.

### Tool dispatch: concurrency partitioning

```
┌───────────────────────────────────────────────────────────────────┐
│  Tool calls collected in one streaming response                    │
│                                                                   │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐    │
│  │ concurrent  │  │ serial                                  │    │
│  │             │  │                                         │    │
│  │ ReadTool ●  │  │ BashTool ●  WriteTool ●  AgentTool ●   │    │
│  │ WebFetchTool│  │ (run one at a time, in order)           │    │
│  │             │  │                                         │    │
│  │ → Promise.  │  │ → await dispatch() for each, serially  │    │
│  │   allSettled│  │                                         │    │
│  └─────────────┘  └─────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `●` | Tool instance (input port in the dispatch pipeline) |
| `→ Promise.allSettled` | Concurrent tools run in parallel, failures isolated |
| `→ await dispatch() serially` | Destructive tools run one at a time |

> Note: Wave 1 dispatches all tool calls serially for correctness. The
> concurrency field is set on each tool and will be used in Wave 1.1 to
> fan out safe tools.

### Hook system

```
┌───────────────────────────────────────────────────────────────────┐
│  runHook(event, ctx, cwd)                                         │
│                                                                   │
│  hookPath = cwd + '/.ai/hooks/' + event + '.sh'                  │
│                                                                   │
│  existsSync(hookPath)?  ──No──► { continue: true }               │
│       │                                                           │
│       Yes                                                         │
│       │                                                           │
│  execFileAsync(hookPath, env={ HOOK_CTX: JSON.stringify(ctx) })  │
│       │                                                           │
│  exit 0 ──────────────────────► { continue: true }               │
│       │                                                           │
│  exit ≠ 0                                                         │
│       │                                                           │
│  event == 'PreToolUse'? ──Yes──► { continue: false }  ← abort   │
│       │                                                           │
│       No ─────────────────────► { continue: true }   ← log only │
└───────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──No──►` | Condition branch — false path |
| `──Yes──►` | Condition branch — true path |
| `← abort` | Hook blocks tool execution |
| `← log only` | Non-PreToolUse hooks can't abort |

Hook events: `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionStop`,
`StepStart`, `StepComplete`. Hook scripts receive context as `$HOOK_CTX` (JSON string).

### SessionPanel layout

```
┌─ Session ──────────────────────────────────────────────────────────┐
│                                                                     │
│  line 0: system  "factory v0.2.0 — type a message or /help"        │
│  line 1: user    "> hello claude"                                   │
│  line 2: asst    "Hello! How can I help you today?"                 │
│  line 3: system  "  tool: Bash"                                     │
│  line 4: system  "  → ls output preview..."                         │
│  ...                                                                │
│  [scrollback — arrow_up/down to scroll]                            │
│─────────────────────────────────────────────────────────────────── │
│  > _ [input bar — last row of inner rect]                          │
└────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `┌─┐└┘│` | Panel border (drawn by `drawBorder` in Wave 0) |
| `─── ` | Visual divider between scrollback and input bar |
| `> _` | User input prompt with cursor |

Text roles and colours: `user` = accent (blue), `assistant` = text (default),
`system` = textDim (grey). Long lines word-wrap to panel width.

---

## Usage

### Launch factory and start a session

```bash
$ factory
# Full TUI opens. Press 1 or Tab to focus the Session panel.
# Type a message and press Enter — Claude streams the reply live.
# Type /help for available slash commands.
# Press Ctrl+Q to exit.
```

### Available slash commands

```bash
/help     # Show available commands
/clear    # Reset session history and scrollback
/tokens   # Print approximate token count for current session
```

### Environment setup

```bash
# Required: Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run the TUI
$ factory

# Or run health check
$ factory doctor
```

### Run tests

```bash
$ npm test
# 23 tests across 5 files — all must pass
```

### Build

```bash
$ npm run build
# tsup compiles src/index.ts → dist/index.js
$ node dist/index.js --version
# 0.2.0
```

---

## Test coverage

**Test files:**

| File | Tests | What is covered |
|------|-------|----------------|
| `src/core/session.test.ts` | 6 | history ordering, tokenCount, clear |
| `src/core/agent-loop.test.ts` | 4 | text_delta stream, turn_end, history mutation, AbortSignal |
| `src/core/tools/bash.test.ts` | 5 | exec, non-zero exit, stderr, Zod validation, concurrent flag |
| `src/core/tools/read.test.ts` | 4 | read file, missing file, Zod validation, concurrent flag |
| `src/tui/renderer/cell-buffer.test.ts` | 4 | (carried from Wave 0) |

**Not yet tested:**
- `runHook()` (requires filesystem + execFile mocking)
- `SessionPanel` (requires a real or mocked TTY)
- `AgentsPanel.render()` (requires CellBuffer test harness)
- `WebFetchTool` (requires network or `fetch` mock)
- `WriteTool` (side-effectful — tested manually)
- Multi-turn tool loop in `agentLoop` (integration test, deferred to Wave 1.1)

---

## Known limitations

- **Single session only.** `AgentsPanel` is a static list showing one entry. Multiple
  concurrent agent sessions require a session registry (Wave 3).
- **No streaming abort from UI.** The `AbortController` signal path is implemented in
  `agentLoop` and tested, but the TUI has no keybind to trigger it yet.
- **Slash command set is minimal.** Only `/help`, `/clear`, `/tokens`. `/run <plan>`
  and `/spawn <agent>` require Wave 3 (DAG executor).
- **Tool dispatch is serial.** All tools run one at a time in Wave 1. Concurrent
  fan-out for `concurrent: true` tools is deferred to Wave 1.1.
- **No prompt caching.** The `cache_control` block is not attached to system messages
  yet — deferred until token usage becomes significant.
- **`q` no longer exits.** Wave 1 routes `q` to the focused SessionPanel as a literal
  character input. Use `Ctrl+Q` or `Ctrl+C` to quit.
