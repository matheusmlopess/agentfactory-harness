<!-- version: 1.0.0 -->
# Future Work — AgentFactory Harness Roadmap

Detailed planning for features beyond Wave 5, organized by priority and effort.

---

## Active Development

### GH #21: Project Sessions (Wave 5.5) — **HIGH PRIORITY**

**Goal**: Group multiple sessions under a named project (e.g., the cwd name).

**User story**:
- Open the app in a project directory
- Create 5 sessions as you explore and debug
- Later: "Resume Project" → reload all 5 sessions in one action
- See aggregated token usage across all sessions

**Architecture**:

```
~/.config/agentfactory/
├── sessions/
│   ├── 2026-06-09/
│   │   ├── rollout-2026-06-09T10-30-00Z-Einstein.jsonl
│   │   ├── rollout-2026-06-09T11-45-00Z-Curie.jsonl
│   │   └── rollout-2026-06-09T14-20-00Z-Lovelace.jsonl
│   └── ...
├── projects/
│   └── project-meta.json
│       {
│         "name": "my-app",
│         "rootDir": "/home/user/Projects/my-app",
│         "createdAt": "2026-06-09T10:30:00Z",
│         "sessions": [
│           "2026-06-09/rollout-2026-06-09T10-30-00Z-Einstein.jsonl",
│           "2026-06-09/rollout-2026-06-09T11-45-00Z-Curie.jsonl"
│         ]
│       }
```

**Implementation**:
1. `src/core/project-store.ts` — CRUD for project metadata
2. `src/tui/panels/SessionPanel.ts` — extend `openNewSessionMenu` to show "New Project Session"
3. `/project resume <name>` command — reload all sessions in a project
4. SessionPanel multi-session switcher: group sessions by project

**Tests**: 6–8 (project CRUD, loading, filtering)

**Effort**: Low–Medium (2–3 days)

**Depends on**: Wave 5 (rollout system)

---

## Wave 5.5 — Harness Integration 🚧

### Read .ai/ Directory Structure

**Goal**: Load harness context files (rules, agent manifests, briefs).

**What's needed**:

```typescript
// src/harness/reader.ts
export interface HarnessContext {
  rules: RuleFile[]
  agents: AgentManifest[]
  brief: BriefDocument
  skills: SkillRegistry
}

export async function readHarness(rootDir: string): Promise<HarnessContext>
```

**Files to parse**:
- `.ai/AgentFactory.md` — master brief
- `.ai/rules/*.md` — enforced rules (1–10)
- `.ai/agents/*/agent-manifest.json` — agent definitions
- `.ai/skills/*/SKILL.md` — skill registrations

**Integration points**:
- `factory doctor` — validate `.ai/` structure
- Orchestration executor — check plan against rules
- SessionPanel — display available agents before orchestration

**Tests**: 8–10

**Effort**: Low (2 days)

---

### Agent Manifest Parser

**Goal**: Validate and parse `agent-manifest.json` files.

**Schema** (Zod):

```typescript
export const AgentManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  license: z.string(),
  homepage: z.string().url().optional(),
  
  inputs: z.record(z.string(), z.object({
    type: z.enum(['string', 'number', 'boolean', 'array']),
    description: z.string(),
    required: z.boolean(),
  })),
  
  outputs: z.record(z.string(), z.object({
    type: z.enum(['string', 'number', 'json']),
    description: z.string(),
  })),
  
  tools: z.array(z.string()),  // tool names this agent uses
  model: z.object({
    provider: z.enum(['anthropic', 'openai']),
    id: z.string(),  // e.g., 'claude-opus-4-8'
  }).optional(),
  
  hooks: z.record(z.string(), z.string()).optional(),
})
```

**Tests**: 5–6 (valid/invalid manifests, schema validation)

**Effort**: Low (1 day)

---

## Wave 6 — Skills & Marketplace 📋

### Skill Installation from Registry

**Goal**: `/skill install <name>` to download and register a skill.

**Flow**:

```
user runs: /skill install date-parser
    ↓
registryClient.get('/skills/date-parser/latest')
    ↓
download .tar.gz → ~/.config/agentfactory/skills/date-parser/
    ↓
validate SKILL.md + manifest.json
    ↓
register in .ai/skills/ symlink or copy
    ↓
"✓ Skill installed. Use /date-parser in your agent."
```

**Files**:
- `src/registry/skills.ts` — skill CRUD
- CLI command: `factory skill install <name>`
- Registry API: `POST /skills/<id>/install` (increment usage counter)

**Tests**: 8–10

**Effort**: Medium (3–4 days)

---

### Skill Marketplace Browser

**Goal**: Browse available skills in-app.

**UI**:
```
┌───────────────────────────────────┐
│ SKILL MARKETPLACE                 │
├───────────────────────────────────┤
│ Search: [_____________________]   │
│ Filter: [All] [Data] [Tools]      │
├───────────────────────────────────┤
│ • date-parser      ★★★★★         │
│   Parse dates in 20+ formats      │
│   by @alice · installed: 1.2k    │
│                   [Install]      │
│                                   │
│ • email-validator  ★★★★☆         │
│   RFC 5321 + deliverability      │
│   by @bob · installed: 800       │
│                   [Install]      │
│                                   │
│ [↑ ↓] scroll  [Enter] details     │
└───────────────────────────────────┘
```

**Implementation**:
- `src/tui/panels/SkillMarketplace.ts` — extends Panel
- ScrollableList widget for skills
- Click Install → download + register
- F6 key to open (or `/skills` command)

**Tests**: 10–12 (list, search, install flow)

**Effort**: Medium (3–5 days)

---

### Skill Authorship & Governance

**Goal**: Define who can publish skills, versioning, deprecation.

**Features**:
- Skill author profile (GitHub, email, bio)
- Semantic versioning (`1.0.0`, `1.1.0-beta`, etc.)
- Deprecation marking (old versions marked as "Use 2.0 instead")
- Integrity check (manifest hash on registry)

**Docs**:
- `.ai/rules/skill-authorship.md` — who can publish, review process
- `SKILL.md` template with author/version sections

**Effort**: Low (governance doc + schema update)

---

## Wave 7 — Agent Designer 🎨

### Visual Agent Builder (Future)

**Goal**: Create agents graphically without writing code.

**UI** (sketch):

```
┌──────────────────────────────────────┐
│ New Agent: [____________________]    │
├──────────────────────────────────────┤
│ Inputs          │ Agent          │ Outputs
│                 │                │
│ • query    ──┐  │  ┌────────┐   │  • result
│   (string)   │  │  │ Claude │   │    (string)
│              │  │  │ Opus   │   │
│ • context  ──┼─►│  └────────┘   │  • usage
│   (string)   │  │                │    (json)
│              │  │ [Tools]        │
│ • lang     ──┘  │ ✓ read         │
│   (string)      │ ✓ web-fetch    │
│                 │ □ bash         │
│                 │                │
│ [✓ Test]  [Save]  [Export]      │
└──────────────────────────────────────┘
```

**Features**:
- Drag inputs/outputs to build agent shape
- Select model from picker
- Toggle tools on/off
- Test agent with sample inputs
- Export as af-plan.json step or as skill

**Tests**: 15–20 (UI, validation, export)

**Effort**: Very High (2+ weeks)

**Depends on**: Wave 6 (skills)

---

## Wave 8 — Collaboration 🌐

### Plan Sharing

**Goal**: Export plan to registry, share link with team.

**Flow**:
```
user runs: /share
    ↓
"Share plan: Send to registry? [Y/n]"
    ↓
registryClient.post('/plans', { name, description, af_plan_json: ... })
    ↓
"✓ Shared! Link: https://agentfactory.dev/plans/abc123"
```

**Features**:
- Read-only plan viewing
- Clone plan to local
- One-click run (test others' plans)

**Tests**: 8–10

**Effort**: Low–Medium

---

### Session Replay & Sharing

**Goal**: Share session transcripts as read-only replay.

**UI**:
```
┌─ Session Replay ──────────────────┐
│ Curie's Debug Session             │
│ Shared by @alice on 2026-06-09   │
│                                   │
│ > Tell me about this error       │
│ ◂ Claude: It looks like a JSON... │
│                                   │
│ [▶ Play]  [⏸ Pause]  [╳ Close]  │
│                                   │
│ Messages: 12  Tokens: 2,845       │
│ Duration: 4:32                   │
└───────────────────────────────────┘
```

**Implementation**:
- Export session to `.json` (metadata + message log)
- POST to registry with visibility=public
- Render replay UI (SessionPanel read-only mode)

**Tests**: 10–12

**Effort**: Medium

---

### Team Workspaces

**Goal**: Invite collaborators, shared plans, role-based access.

**Features**:
- Create team workspace
- Invite members (send link)
- Role-based permissions (viewer, editor, admin)
- Shared plan library
- Audit log (who ran what, when)

**Effort**: Very High (2+ weeks)

---

## Short-term Enhancements (Q3 2026)

### Session Search & Filter

**Goal**: Find past sessions by keywords, date range.

**UI**:
```
┌─ Session History ───────────────┐
│ Search: [_____________]  [🔍]   │
│ Filter: Date ▼  Model ▼         │
├─────────────────────────────────┤
│ • 2026-06-09 14:20 — Curie      │
│   "debug authentication flow"    │
│   Token usage: 2,845 in / 1,203 out
│                                 │
│ • 2026-06-09 10:30 — Einstein   │
│   "analyze market data"          │
│   Token usage: 5,120 in / 2,890 out
│                                 │
│ [↑ ↓] scroll  [Enter] resume    │
└─────────────────────────────────┘
```

**Implementation**:
- Index sessions by content (full-text search)
- Filter by date, model, token usage
- Store search index in `.index.json`

**Tests**: 6–8

**Effort**: Low–Medium (2–3 days)

---

### Theme Switcher

**Goal**: Dark/light themes, colorblind modes.

**Features**:
- Config command: `/theme [dark|light|high-contrast]`
- Persist in `~/.config/agentfactory/config.json`
- Pre-built palettes:
  - **Dark** (current default)
  - **Light** (inverted colors)
  - **High Contrast** (WCAG AA)
  - **Deuteranopia** (red-green colorblind)
  - **Protanopia** (red-blue colorblind)

**Implementation**:
- Extend `Colors` in `src/tui/renderer/theme.ts`
- Load theme on startup
- CLI: `factory config theme [dark|light|...]`

**Tests**: 4–5

**Effort**: Low (1–2 days)

---

## Medium-term Enhancements (Q4 2026)

### Session Transcripts to Markdown

**Goal**: Export conversations as GitHub-friendly markdown.

**Output** (example):

```markdown
# Claude Debug Session — 2026-06-09

**Duration**: 4:32  
**Model**: Claude Opus 4.8  
**Tokens**: 2,845 input / 1,203 output

---

## Message 1

**You**: Tell me about this error

**Claude**: It looks like a JSON parsing issue...

**Tools used**: none

---

## Message 2

**You**: Can you fix it?

**Claude**: Here's a corrected version...

[code block]
```

**Implementation**:
- `/export markdown` command
- Template with front matter (metadata)
- Code block syntax highlighting

**Tests**: 5–6

**Effort**: Low (1–2 days)

---

### Plan History & Templates

**Goal**: Browse past orchestrations, save as templates.

**UI**:
```
┌─ Plan History ──────────────────┐
│ Recent Runs                     │
│                                 │
│ • 2026-06-09 — ETL Pipeline    │
│   3 steps · 12m runtime         │
│   [Re-run]  [Save as Template]  │
│                                 │
│ • 2026-06-08 — Code Review     │
│   5 steps · 8m runtime          │
│   [Re-run]  [Save as Template]  │
│                                 │
│ [Templates] [History]           │
└─────────────────────────────────┘
```

**Implementation**:
- Store plan executions in `.history.json`
- Template library in `.config/agentfactory/templates/`
- UI for browsing and restoring

**Tests**: 8–10

**Effort**: Medium (3–4 days)

---

## Long-term Vision (2027+)

### Web Dashboard

**Goal**: Cloud-hosted interface for plan management, team collaboration.

**Features**:
- View shared plans / team activity
- Trigger runs from web
- Monitor execution (live logs)
- Team management UI
- API token management

**Tech**: React + Next.js, connecting to agentfactory.dev backend

**Effort**: Very High (4+ weeks)

---

### Mobile App Companion

**Goal**: iOS/Android app for session replay, notifications.

**Features**:
- View shared sessions (read-only)
- Get notifications when plan completes
- Quick status checks
- Settings / API key management

**Tech**: React Native or Flutter

**Effort**: Very High (6+ weeks)

---

### Webhook & CI/CD Integration

**Goal**: Trigger orchestrations from GitHub Actions, GitLab CI, etc.

**Example** (GitHub Actions):

```yaml
- uses: matheusmlopess/agentfactory-run@v1
  with:
    plan: 'specs/plans/test-and-lint.json'
    api-key: ${{ secrets.AGENTFACTORY_API_KEY }}
```

**Implementation**:
- REST API for plan execution
- Webhook support (GitHub push/PR events)
- Job status polling

**Tests**: 10–12

**Effort**: Medium (3–4 days)

---

## Testing & Quality Roadmap

### Increase Coverage to 90%+

**Current**: 86% (269 tests)  
**Target**: 90%+ by Wave 6

**Gap areas**:
- Error path coverage (rare errors)
- Edge cases (malformed input)
- Integration tests (API responses)

**Plan**: Add 30–40 tests across existing modules

**Effort**: Low (incremental, 1–2 per wave)

---

### E2E Testing Suite

**Goal**: Automated UI testing (Puppeteer / Playwright in raw terminal).

**Tests**:
- Full login flow
- Create plan → run → verify output
- Multi-session switching
- Terminal interaction

**Effort**: High (2+ weeks)

---

## Governance & Documentation

### Rule 10: Skill Authorship

**Goal**: Enforce governance for published skills.

**File**: `.ai/rules/skill-authorship.md`

**Contents**:
- Who can publish (verified account, security review)
- Deprecation policy (6-month EOL notice)
- Breaking change guidelines
- Review checklist (tests, docs, examples)

**Effort**: Low (documentation only)

---

### API Reference Documentation

**Goal**: OpenAPI spec for registry API.

**Coverage**:
- Authentication endpoints
- Plan CRUD
- Skill search/install
- Team management

**Tool**: OpenAPI 3.0 + Swagger UI

**Effort**: Medium (2–3 days)

---

## Estimated Timeline

| Milestone | Target | Wave(s) | Effort |
|-----------|--------|---------|--------|
| Project Sessions (GH #21) | Jun 2026 | 5.5 | Low–Med |
| Harness Integration | Jul 2026 | 5.5 | Low |
| Skill Marketplace | Aug 2026 | 6 | Medium |
| v1.0.0 Release | Sep 2026 | 6 | — |
| Web Dashboard | 2027 Q1 | — | Very High |
| Mobile App | 2027 Q2 | — | Very High |
| Team Workspaces | 2027 Q1–Q2 | — | Very High |

---

## How to Help

See `.ai/rules/` and open a PR if you want to implement any of the above.

**Low-effort starters**:
- Theme switcher (1–2 days)
- Session search (2–3 days)
- Markdown export (1–2 days)

**Medium-effort projects**:
- Project sessions (2–3 days)
- Skill installer (3–4 days)
- Webhook integration (3–4 days)

**High-effort (team projects)**:
- Agent designer (2+ weeks)
- Web dashboard (4+ weeks)
- Mobile app (6+ weeks)

All PRs must include:
- Approved plan in `specs/docs/approvedPlans/`
- 80%+ test coverage
- Feature docs in `docs/features/`
- Updated `.ai/project-index.yml`
