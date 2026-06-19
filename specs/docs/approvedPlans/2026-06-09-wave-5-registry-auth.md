# Approved Plan: Wave 5 — Registry Auth + Prompt Bar Redesign
<!-- version: 1.0.0 -->
<!-- approved: 2026-06-09 -->

## Goal

Complete Wave 5 registry authentication (device-code login to agentfactory.dev, JWT token
storage, API key import from installed tools) and redesign the session prompt bar: move
the tool toggle button and model selector to the status bar, clean the input area for text
only, and add multi-line soft-wrap as the input grows. This improves UX by decluttering
the prompt area and making long inputs readable.

---

## Scope

| File | Action | Wave |
|------|--------|------|
| `src/registry/auth.ts` | **implemented** — JWT decode, token read/write/clear from `~/.agentfactory/token` | 5 |
| `src/registry/client.ts` | **implemented** — typed fetch wrapper with Bearer auth | 5 |
| `src/registry/login.ts` | **implemented** — device-code flow with polling + browser auto-open | 5 |
| `src/registry/import-keys.ts` | **implemented** — scan `~/.claude/.credentials.json` and env vars | 5 |
| `src/tui/panels/ConfigPanel.ts` | **extended** — login overlay, import overlay, auth header | 5 |
| `src/tui/panels/SessionPanel.ts` | **extended** — prompt bar multi-line wrap, removed buttons | 5 |
| `src/tui/panels/StatusBar.ts` | **extended** — added tool toggle button + layout return | 5 |
| `src/app.ts` | **extended** — wire status bar toggle click, pass chat mode to status bar | 5 |
| `.ai/project-index.yml` | **update** — flip `registry:` entries to `implemented`, bump meta.wave to 5 | 5 |

Test files:

| File | Action |
|------|--------|
| `src/registry/auth.test.ts` | **exists** — JWT decode, missing handle, malformed, defaults |
| `src/registry/client.test.ts` | **new** — Bearer auth header, POST/DELETE methods, error handling, env var |
| `src/registry/import-keys.test.ts` | **new** — file scanning, env var scanning, deduplication |
| `src/registry/login.test.ts` | **new** — device endpoint error, code emission, polling, expiry, success |

Docs:

| File | Action |
|------|--------|
| `specs/docs/approvedPlans/2026-06-09-wave-5-registry-auth.md` | **new** — this plan |
| `docs/features/FEATURE-WAVE-5-REGISTRY-AUTH-2026-06-09.md` | **new** — public feature doc |
| `README.md` | **extend** — add Authentication section with login/import/logout flow |

---

## Reference material

| Decision | Reference |
|----------|-----------|
| JWT structure (header.payload.signature), payload shape (sub/id, github_handle, email, plan) | `src/registry/auth.ts:32–50` |
| Device-code polling spec (POST /auth/cli/device, GET /auth/cli/poll) | `src/registry/login.ts:39–43` |
| Session storage JSONL structure (meta, user, assistant, tool, stats events) | `src/core/rollout.ts:10–25` |
| Nobel laureate naming + next() strategy | `src/core/nobel.ts` |
| Cell buffer rendering API (write, fill, row-indexed) | `src/tui/renderer/cell-buffer.ts` |

---

## Architecture

### Registry Auth Flow

```
┌─────────────┐
│ /login cmd  │
│ (Config tab │
│  button)    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────┐
│ startDeviceLogin():              │
│ 1. POST /auth/cli/device  (get   │
│    device_code + user_code)      │
│ 2. openBrowser(verifyUrl)        │
│ 3. poll /auth/cli/poll every 3s  │
└──────┬───────────────────────────┘
       │
       ├─ yield 'code' event (userCode, verifyUrl, expiresIn)
       ├─ yield 'progress' events every 3s
       │
       └─ yield 'success' or 'error' (exit generator)
          │ on success:
          ├─ poll.status === 'authorized'
          ├─ saveToken(poll.token) → ~/.agentfactory/token
          └─ emit 'success' with decoded user
```

### Import Keys Flow

```
importFromTools()
├─ try read ~/.claude/.credentials.json → get primaryApiKey
├─ fallback to ~/.openclaude/.credentials.json
├─ scan process.env for matching PROVIDERS (non-alias)
└─ return ImportCandidate[] (configKey, name, source, value)
   ConfigPanel.showImportCandidates() → render import overlay
   user presses Enter → store.setKey() for each candidate
```

### Prompt Bar Multi-Line Wrap

**Before:**
```
> some long user text [tools] [model-id]
```

**After:**
```
> some long user text that wraps to
  the next line and keeps growing as
  [tools] and [model-id] are now only on status bar
```

**Implementation:**
- `wrapText(text, width)` splits input into chunks of `width` chars
- `inputRowCount = min(5, max(1, lines.length))` caps at 5 rows
- Render loop renders from `inputRow - (inputRowCount - 1)` upward
- Lines 1+ use `'  '` prefix instead of `'> '`
- Cursor always at end of buffer

### Status Bar Tool Toggle

**Before:**
```
 factory v0.4.0  [NORMAL]  [model-id]  ...hints... ^Q quit ^E select...
```

**After:**
```
 factory v0.4.0  [NORMAL]  [model-id]  [tools]  ...hints... ^Q quit ^E select...
                                       ↑ clickable, green when [chat]
```

`renderStatusBar()` now takes `chatMode?: boolean` parameter and returns `toolToggleCol/Len`.
App.ts wires click at `(rows-1, toolToggleCol)` → `sessionPanel.toggleChatMode()`.

---

## Test plan

### `client.test.ts` (6 cases)
- `get()` attaches Bearer token when `getToken()` returns a value
- `get()` omits Authorization header when `getToken()` returns null
- `post()` sends JSON body + correct method
- throws `Error('registry 401: ...')` on non-ok response
- uses default API_BASE when env var not set
- `delete()` sends DELETE method

### `import-keys.test.ts` (5 cases)
- returns Anthropic candidate when `~/.claude/.credentials.json` has `primaryApiKey`
- reads `~/.openclaude/.credentials.json` if first path fails
- returns env var candidates for matching PROVIDERS entries
- deduplicates when same configKey found in both file and env
- returns empty array when no file and no env vars

### `login.test.ts` (6 cases)
- yields error immediately when `/auth/cli/device` throws
- yields code event with `userCode` and `verifyUrl` on success
- calls `registryClient.post` with `/auth/cli/device` path
- calls `saveToken` with token from authorized response
- emits error when poll returns `expired` status
- emits success with user object from poll response

### SessionPanel / StatusBar / App integration (manual)
- Prompt bar renders input with no buttons
- Type 50-char sentence → wraps to 2+ rows
- Status bar shows `[tools]` (accent bg) and `[model]` tag
- Click `[tools]` on status bar → toggles to `[chat]` (green bg)
- F5 → Config → `[→ Login]` → device-code overlay appears
- F5 → Config → `[→ Import keys]` → import overlay shows candidates

---

## Key bindings (Wave 5)

| Key | Action |
|-----|--------|
| F5 or Ctrl+P → "Login to AgentFactory" | Start device-code login flow |
| F5 or Ctrl+P → "Logout from AgentFactory" | Clear token, logout |
| Click `[tools]` on status bar | Toggle chat mode on/off |
| Click `[model]` on status bar | Open model picker |
| Enter (in import overlay) | Import all candidates to config store |

---

## Out of scope (Wave 5)

- Harness reader (`src/harness/reader.ts`) — planned for Wave 5.5+
- Agent manifest parser (`src/harness/manifest.ts`) — planned for Wave 5.5+
- Project sessions (GH issue #21) — planned for Wave 5.5+
- OAuth / OIDC — device code auth is the only supported method
- Token refresh — tokens are static; user must re-login if expired
