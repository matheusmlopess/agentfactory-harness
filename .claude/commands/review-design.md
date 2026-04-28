# /review-design

Perform a meticulous security and design review of the current state of agentfactory-harness.
Produce a dated Markdown report with full Mermaid diagrams, every security finding, all design
gaps, component status, and test coverage — then open a GitHub issue with the gaps.

---

## Step 1 — Explore (3 parallel agents)

Launch three Explore agents IN PARALLEL in a single message:

**Agent A — Architecture:** Read `.ai/project-index.yml` in full. Then read every source file
listed as implemented. For each file report: what it exports, what it imports, key types, and
what data it passes to other modules. Map the complete dependency graph. Identify any circular
imports, missing glue code between layers, or modules that claim to connect but don't.

**Agent B — Security:** Read every `.ts` source file. Check for:
- Command injection (`exec`, `execSync`, `spawn` with shell:true)
- Path traversal (file_path used without `path.resolve()` + root boundary check)
- Secrets in code (hardcoded tokens, API keys, credentials)
- Input validation gaps (unvalidated inputs, `z.any()`, silent catch blocks)
- Sensitive data in env vars, logs, or error messages
- ANSI / control character injection in terminal output
- Unbounded resource accumulation (arrays without size caps)
- Hook execution risks (env var leaks, no timeout, path construction)
- TypeScript safety holes (`as any`, `!` non-null assertions, `@ts-ignore`)
Rate each finding: Critical / High / Medium / Low with file path and approximate line.

**Agent C — Test coverage:** Run `find src -name "*.test.ts"` and `find src -name "*.ts" | grep -v test`. Cross-reference: which source files have zero test coverage? Read each test file and assess quality (happy path only vs edge cases). Check project-index.yml status column against actual files on disk. List every discrepancy.

---

## Step 2 — Write the report

Create the report file at:
```
docs/REVIEW-security-design-<YYYY-MM-DD>.md
```
where `<YYYY-MM-DD>` is today's date.

The report MUST contain ALL of the following sections, in this order:

### Required sections

1. **Executive Summary** — finding counts by severity, coverage %, open wave count

2. **Full System Architecture** — TWO Mermaid diagrams:
   - Layer map: every implemented module in its layer (Entry / Renderer / Input / Panels / Widgets / Core / Harness), plus planned modules greyed out
   - Module dependency graph: who imports what (flowchart LR)

3. **Data Flow Workflows** — ALL of the following Mermaid diagrams:
   - User message → Claude response: full `sequenceDiagram` from keypress to rendered output
   - Tool dispatch: `flowchart TD` from `dispatch(name, rawInput)` through Zod validation to result
   - Hook execution: `sequenceDiagram` showing file check, execFile, exit code branching
   - TUI render pipeline: `flowchart LR` showing double-buffer diff cycle
   - Input routing: `flowchart TD` from raw stdin bytes to panel handler
   - Canvas state machine: `stateDiagram-v2` with Idle / Dragging / MenuOpen states
   - Agent loop turn logic: `flowchart TD` showing the full per-turn loop with all branches

4. **Security Findings** — For EACH finding:
   - ID (S1, S2, …), severity badge, file + line
   - What the vulnerable code looks like (code block)
   - Attack scenario (how it could be exploited)
   - Recommended fix (code block showing the fix)
   - A `Security Attack Surface Map` Mermaid diagram showing all vectors

5. **Design Gaps & Open Ends** — For EACH gap:
   - Descriptive title
   - Mermaid diagram showing current state vs needed state (where applicable)
   - Table of missing glue code / modules with file paths
   - Specific missing slash commands table
   - Hook system limitation table
   - Wave 3-5 roadmap Mermaid diagram

6. **Component Status Matrix** — Mermaid flowchart with three subgraphs:
   - ✅ Implemented and tested (with test count)
   - 🟡 Implemented, no tests
   - ⏳ Planned, not started

7. **Test Coverage Report**
   - Pie chart Mermaid diagram (tested vs untested vs planned)
   - Table: each test file, number of tests, what it proves, what it misses
   - Priority table: untested files ranked by risk

8. **Recommendations** — Four tables:
   - Immediate (security, fix before public use) — file, action, estimated effort
   - Short-term (design completeness) — file, action
   - Wave 3 prerequisites (ordered by dependency)
   - Test coverage additions needed (list of test files to create)

### Mermaid diagram rules

- Use `flowchart TD` or `flowchart LR` (not `graph`)
- Node labels with spaces must use `["..."]` syntax
- Subgraph syntax: `subgraph ID["Title"]` … `end`
- Planned/unbuilt nodes: `style NODE fill:#ffe0b2,stroke:#aaa` or `stroke-dasharray:5`
- Every diagram must be self-contained and renderable in GitHub Markdown

---

## Step 3 — Open GitHub issue

After writing the report, run:

```bash
gh issue create \
  --title "Security & Design Gaps — Full Audit <YYYY-MM-DD>" \
  --label "bug,enhancement" \
  --body "<structured body>"
```

The issue body MUST contain:
- All design gaps (one `###` heading per gap, with tables)
- All security findings grouped by severity (Critical / High / Medium / Low)
- A prioritized fix checklist (checkboxes)
- A `<details>` block at the end referencing the full report file

---

## Step 4 — Confirm

Report back:
- Path to the new report file
- GitHub issue URL
- Finding counts: X Critical · Y High · Z Medium · W Low
- Coverage: N tested / M total source files (P%)
- Count of design gaps found
