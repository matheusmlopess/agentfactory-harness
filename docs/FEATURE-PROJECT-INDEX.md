# Feature: Project Index
<!-- version: 1.0.0 -->

## What it does

`.ai/project-index.yml` is a machine-readable YAML registry of every file in the
`agentfactory-harness` repo — both implemented and planned. Agents (Claude, Gemini,
Codex) read it as first-stop context before any search, eliminating unnecessary directory
traversal. It is also queryable via `yq` for automation and CI tasks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       .ai/project-index.yml                         │
│                                                                     │
│  meta:                          ← version, wave, description        │
│    version / wave / description                                     │
│                                                                     │
│  tui_renderer:   [ ...entries ] ← section = top-level YAML key     │
│  tui_input:      [ ...entries ]                                     │
│  tui_panels:     [ ...entries ]                                     │
│  tui_widgets:    [ ...entries ]                                     │
│  core:           [ ...entries ]                                     │
│  orchestration:  [ ...entries ]                                     │
│  harness:        [ ...entries ]                                     │
│  registry:       [ ...entries ]                                     │
│  cli:            [ ...entries ]                                     │
│  governance:     [ ...entries ]                                     │
│  docs:           [ ...entries ]                                     │
│  config:         [ ...entries ]                                     │
│  maintenance:    { rules }      ← update contract (not file list)   │
└─────────────────────────────────────────────────────────────────────┘
          │
          │  referenced by
          ▼
┌──────────────────────────┐    ┌───────────────────────────────────┐
│  .ai/AgentFactory.md     │    │  .ai/adapters/claude/brief.md     │
│  § Project Index         │    │  Rule 8 — Search Index First      │
│  § Search Protocol       │    │  Key Files table (first row)      │
└──────────────────────────┘    └───────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `┌─┐└─┘│` | File or component boundary |
| `[ ...entries ]` | YAML sequence (list of file entry objects) |
| `{ rules }` | YAML mapping (key/value maintenance rules) |
| `──►` | Reference / dependency direction |

### Entry schema

Every entry in a section list conforms to this shape:

```yaml
- path: src/tui/renderer/cell-buffer.ts   # repo-relative path
  purpose: "One-line description"          # what the file does
  exports:                                 # key symbols (omitted for non-code)
    - "CellBuffer (class)"
    - "diff(prev: CellBuffer): string"
  wave: 0                                  # integer: which wave adds this file
  status: implemented                      # implemented | planned | stub
```

Governance and config entries use `version` instead of `wave` + `exports`:

```yaml
- path: .ai/AgentFactory.md
  purpose: "Master project brief"
  version: "1.1.0"
  status: implemented
```

---

## How it works

### Agent lookup flow

```
Agent session opens repo
         │
         ▼
  Read .ai/AgentFactory.md  ──► § Search Protocol instructs:
         │                        1. read .ai/project-index.yml first
         │                        2. locate the relevant section
         ▼                        3. read that file directly
  Read .ai/project-index.yml
         │
         ├── section: tui_renderer  ──► look for cell-buffer, ansi, layout, theme
         ├── section: core          ──► agent-loop, hooks, session, tools/*
         ├── section: governance    ──► rules, brief, milestones
         └── ...
         │
         ▼
  Read the specific file (path from YAML entry)
  No find, no grep, no tree walk needed
```

| Symbol | Meaning |
|--------|---------|
| `──►` | Leads to / references |
| `├──` | One of several parallel section options |
| `└──` | Final branch |

### yq query engine

Because entries are typed YAML, any yq-compatible tool can filter without custom parsing:

```bash
# All planned files in a specific wave
yq '.core[] | select(.status == "planned" and .wave == 1) | .path' \
  .ai/project-index.yml

# Every file implementing a specific export
yq '.. | select(type == "!!seq")[] | select(.exports != null) |
    select(.exports[] | contains("CellBuffer")) | .path' \
  .ai/project-index.yml

# Status summary across all sections
yq '[.. | select(type == "!!seq")[] | .status] | group_by(.) |
    map({(.[0]): length}) | add' \
  .ai/project-index.yml
```

### Maintenance contract

The `maintenance:` block at the bottom of the YAML encodes the update rules as data:

```yaml
maintenance:
  new_file: Add entry in the same commit, same PR
  rename_or_delete: Update path in the same commit
  wave_closes: "Flip status planned → implemented; bump meta.wave"
  version_bump: minor per wave, patch per single-file addition
```

This is enforced by Rule 3 (`doc-before-commit.md`) steps 5–6, which require index
updates as part of the pre-commit checklist.

---

## Usage

### Read the index before any file search

```bash
# In a terminal session or agent context
cat .ai/project-index.yml

# Jump directly to the renderer section
yq '.tui_renderer' .ai/project-index.yml
```

### Query planned work for the next wave

```bash
$ yq '[.[][] | select(.status == "planned" and .wave == 1) | .path]' \
    .ai/project-index.yml

# Expected output (Wave 1 targets):
- src/core/agent-loop.ts
- src/core/session.ts
- src/core/hooks.ts
- src/core/tools/index.ts
- src/core/tools/bash.ts
- src/core/tools/read.ts
- src/core/tools/write.ts
- src/core/tools/web-fetch.ts
- src/core/tools/agent.ts
- src/tui/panels/SessionPanel.ts
- src/tui/panels/AgentsPanel.ts
- src/tui/widgets/CommandPalette.ts
```

### Find a file's exports without opening it

```bash
$ yq '.tui_renderer[] | select(.path == "src/tui/renderer/cell-buffer.ts") |
    .exports[]' .ai/project-index.yml

# Expected output:
Cell (interface)
CellBuffer (class)
write(row, col, text, style)
fill(row, col, h, w, char, style)
diff(prev: CellBuffer): string
flush(): string
clone(): CellBuffer
```

### Update the index when adding a new file

```bash
# After creating src/core/agent-loop.ts in Wave 1:
# 1. Open .ai/project-index.yml
# 2. Locate the 'core:' section
# 3. Change status: planned → implemented for that entry
# 4. git add .ai/project-index.yml alongside the new source file
# 5. Commit both in the same commit (Rule 3 step 5)
```

---

## Test coverage

The project index is a static data file — there is no runtime code to unit-test.
Correctness is enforced by convention (Rule 3 checklist) and can be validated with:

```bash
# Validate YAML is well-formed
yq '.' .ai/project-index.yml > /dev/null && echo "valid"

# Check that every entry has required fields
yq '[.. | select(type == "!!seq")[] |
    select(.path == null or .purpose == null or .status == null) |
    .path // "MISSING PATH"] | length' .ai/project-index.yml
# Expected: 0  (no entries with missing required fields)

# Confirm all status values are in the allowed set
yq '[.. | select(type == "!!seq")[] | .status] | unique' \
  .ai/project-index.yml
# Expected: [implemented, planned, stub]
```

Not tested:
- Completeness (no automated check that every src/ file has an entry)
- Staleness detection (no check that `status: implemented` files actually exist)

These are candidates for a Wave 5 `factory doctor` extension.

---

## Scenario walkthroughs

### Scenario A — Agent opens repo cold, needs to find the cell-buffer renderer

```
Session start
     │
     ▼
Read .ai/AgentFactory.md  ──► "§ Search Protocol: read project-index.yml first"
     │
     ▼
Read .ai/project-index.yml
     │
     └── section: tui_renderer
              │
              ├── ansi.ts        status: implemented
              ├── cell-buffer.ts status: implemented  ◄── target found
              ├── layout.ts      status: implemented
              └── theme.ts       status: implemented
     │
     ▼
Read src/tui/renderer/cell-buffer.ts  (direct, no search)
```

| Symbol | Meaning |
|--------|---------|
| `──►` | Follows instruction or pointer |
| `└──` | Drills into section |
| `◄──` | Match found at this row |

1. Agent reads `AgentFactory.md` — §Search Protocol says to read `project-index.yml` first.
2. Agent opens `project-index.yml`, navigates to `tui_renderer` section.
3. Row with `path: src/tui/renderer/cell-buffer.ts` located — no `grep`, no `find`.
4. Agent reads that file directly by path.
5. Total extra files read: 2 (`AgentFactory.md` + `project-index.yml`) instead of exploring the full tree.

---

### Scenario B — Developer adds `src/core/agent-loop.ts` in Wave 1

```
implement agent-loop.ts
         │
         ▼
npm test passes
         │
         ▼
write docs/FEATURE-WAVE-1-SESSION.md  (Rule 3)
         │
         ▼
open .ai/project-index.yml
         │
         └── core: section
                  │
                  └── agent-loop.ts entry
                           │
                           ├── status: planned  ──► change to: implemented
                           └── wave: 1          (unchanged)
         │
         ▼
git add src/core/agent-loop.ts  \
        docs/FEATURE-WAVE-1-SESSION.md  > single commit
        .ai/project-index.yml          /
```

| Symbol | Meaning |
|--------|---------|
| `──►` | Field value change |
| `\` `>` `/` | Files grouped into one commit |

1. New file is written and tests pass.
2. Feature doc written (Rule 3 step 1–4).
3. Developer opens `project-index.yml`, finds the `agent-loop.ts` entry under `core:`.
4. `status: planned` flipped to `status: implemented`.
5. All three files staged and committed together — Rule 3 step 5 satisfied.

---

### Scenario C — Wave 1 closes (all files implemented)

```
Last Wave 1 file committed
         │
         ▼
open .ai/project-index.yml
         │
         ├── meta.wave: 0  ──► bump to: 1
         │
         └── every entry where wave == 1
                  │
                  └── status: planned  ──► implemented  (flip all)
         │
         ▼
git add .ai/project-index.yml
git commit "chore: wave 1 complete — flip index status"
```

| Symbol | Meaning |
|--------|---------|
| `──►` | Value update |
| `└──` | Applies to all matching entries |

1. All Wave 1 files are implemented and merged.
2. `meta.wave` in `project-index.yml` bumped from `0` to `1`.
3. All entries with `wave: 1` and `status: planned` flipped to `status: implemented`.
4. Index `version` minor-bumped (e.g., `1.0.0` → `1.1.0`).
5. Committed as a standalone governance commit on `main`.

---

## Known limitations

- **Manual maintenance only.** There is no script that auto-generates the index from
  the filesystem. A developer who skips step 5 of the Rule 3 checklist will leave the
  index stale.
- **No staleness detection.** `factory doctor` does not currently verify that
  `status: implemented` entries actually exist on disk.
- **No completeness check.** No automated scan confirms every `src/` file has an entry.
- **Exports list is hand-maintained.** Signatures in the `exports:` field are written
  by hand and can drift from the actual TypeScript signatures as code evolves.
- **yq availability assumed.** Queries shown in §Usage require `yq` (mikefarah/yq v4+).
  The index is still useful without it — read it as plain YAML.
