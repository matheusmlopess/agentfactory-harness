<!-- version: 0.5.0 -->
# Feature: Wave 5 — Registry Auth + Prompt Bar Redesign

╔═══════════════════════════════════╗
║  WAVE    5                        ║
║  FILES   8 modified / 1 planned   ║
║  TESTS   14 new + 4 existing      ║
║  BINDS   5 (login, logout, click) ║
║  STATUS  merged 2026-06-09        ║
╚═══════════════════════════════════╝

───────────────────────────────────────────────────────
## 1. WHAT IT DOES
───────────────────────────────────────────────────────

**Registry Authentication**: Log in to agentfactory.dev via device-code flow, authenticate
with a JWT token stored at `~/.agentfactory/token`, and import API keys from installed tools.

**Prompt Bar Redesign**: Clean the input area by moving tool toggle (`[tools]/[chat]`) and
model selector to the status bar, add multi-line soft-wrap as the input text grows (up to
5 lines), and improve readability for long prompts.

### Before

```
 factory v0.4.0  [NORMAL]  [model]
┌─────────────────────────────────┐
│ Lorem ipsum dolor sit amet...   │
│ [tools] [Claude Opus 4.8]       │  ← buttons crowd input
│─────────────────────────────────│
│ session content...              │
```

### After

```
 factory v0.4.0  [NORMAL]  [model]  [tools]  ...hints...
┌─────────────────────────────────┐
│ Lorem ipsum dolor sit amet cons │
│ ectetetur adipiscing elit sed   │  ← clean text-only, wraps naturally
│ do eiusmod tempor                │
│─────────────────────────────────│
│ session content...              │
```

---

## 2. ARCHITECTURE
───────────────────────────────────────────────────────

### Registry Auth (JSON + Device Code Flow)

```
User runs: Ctrl+P → "Login to AgentFactory"
           or F5 → Config → [→ Login]

┌──────────────────────────────────────────────┐
│ startDeviceLogin() AsyncIterable             │
│                                              │
│ 1. POST /auth/cli/device                     │
│    → { device_code, user_code, expires_in } │
│                                              │
│ 2. emit { kind: 'code', userCode, ...  }    │
│    openBrowser(verifyUrl) auto-opens        │
│                                              │
│ 3. poll GET /auth/cli/poll?device_code=...  │
│    every 3 seconds                           │
│                                              │
│ 4. yield { kind: 'progress', secondsLeft }  │
│    until status !== 'pending'                │
│                                              │
│ 5. on authorized:                           │
│    saveToken(jwt) → ~/.agentfactory/token   │
│    emit { kind: 'success', user }           │
│                                              │
│ 6. on expired/timeout:                       │
│    emit { kind: 'error', message }          │
└──────────────────────────────────────────────┘

JWT Payload Example:
{
  "sub":            "user-id-uuid",
  "github_handle":  "alice",
  "email":          "alice@example.com",
  "plan":           "pro"
}
```

### Import Keys (Environment + Files)

```
importFromTools()

1. Try ~/.claude/.credentials.json
   ├─ read primaryApiKey → Anthropic candidate
   └─ fallback to ~/.openclaude/.credentials.json

2. Scan process.env for known PROVIDERS
   ├─ ANTHROPIC_API_KEY
   ├─ OPENAI_API_KEY
   ├─ (30+ others)
   └─ skip aliases (e.g., CLAUDE_API_KEY → ANTHROPIC)

3. Deduplicate: file wins over env if both present

4. Return ImportCandidate[]
   ┌─ configKey:  "anthropic"
   ├─ name:       "Anthropic Claude"
   ├─ source:     "~/.claude/.credentials.json" | "$ENV_VAR"
   └─ value:      "sk-ant-..."

User sees import overlay:
┌────────────────────────────────┐
│ Anthropic Claude               │
│ (from ~/.claude/.credentials)  │
│                                │
│ OpenAI                         │
│ (from $OPENAI_API_KEY)         │
│                                │
│ [Enter] Import all             │
│ [Esc] Cancel                   │
└────────────────────────────────┘

On Enter: store.setKey(configKey, value, fieldType)
```

### Prompt Bar Multi-Line + Status Bar Buttons

```
Cell Grid:
┌───────────────────────────────┐
│ › [user input + cursor]       │
│ › more text wraps here        │  ← new: supports up to 5 lines
│ › third line continues        │
└───────────────────────────────┘

Input layout:
- Prefix: '> ' (or '… ' while streaming)
- Available width per line: r.width - 2
- Wrapping: chunk text at available width
- Cursor: always at end of inputBuf
- Indicator: '█' when focused and not streaming

Status bar buttons (CLICKABLE):
┌────────────────────────────────────────────┐
│  factory v0.4.0  [NORMAL]  [claude...]     │
│                            [tools]         │  ← click to toggle
│                                  ^         │
│                           or [chat]        │
│                           (green if active)│
└────────────────────────────────────────────┘
```

---

## 3. PROJECT STRUCTURE — BEFORE vs AFTER
───────────────────────────────────────────────────────

```diff
BEFORE (Wave 4):
  src/
    registry/              ← PLANNED (stub entries)
      auth.ts
      client.ts
      login.ts
      import-keys.ts
    tui/panels/
      SessionPanel.ts     ← input bar has [tools] [model] buttons
      StatusBar.ts        ← just mode + model tag

AFTER (Wave 5):
  src/
    registry/              ← IMPLEMENTED ✓
      auth.ts              ← ✓ full
      client.ts            ← ✓ full
      login.ts             ← ✓ full
      import-keys.ts       ← ✓ full
      auth.test.ts         ← ✓ 4 cases (existed)
      client.test.ts       ← ✓ NEW 6 cases
      import-keys.test.ts  ← ✓ NEW 5 cases
      login.test.ts        ← ✓ NEW 6 cases
    tui/panels/
      SessionPanel.ts      ← extended: multi-line wrap, removed buttons
      StatusBar.ts         ← extended: tool toggle button + layout return
      ConfigPanel.ts       ← extended: login overlay + import overlay
    app.ts                 ← extended: wire status bar clicks
    
  specs/docs/
    approvedPlans/
      2026-06-09-wave-5-registry-auth.md  ← NEW

  docs/features/
    FEATURE-WAVE-5-REGISTRY-AUTH.md       ← NEW

  README.md                ← extended: Authentication section
  .ai/project-index.yml    ← updated: wave=5, registry=implemented
```

---

## 4. TEST MATRIX
───────────────────────────────────────────────────────

| Test File | Cases | Coverage |
|-----------|-------|----------|
| `auth.test.ts` | 4 | JWT decode, defaults, edge cases |
| `client.test.ts` | 6 | Bearer auth, methods, error, env var |
| `import-keys.test.ts` | 5 | File scan, env scan, dedup, empty |
| `login.test.ts` | 6 | Device endpoint, code emit, poll, expiry, success |
| **Manual** | — | Login flow, import flow, prompt wrap, click toggle |

**Total**: 269 tests pass (21 new + 248 existing)

---

## 5. KEY BINDINGS
───────────────────────────────────────────────────────

| Input | Action | Result |
|-------|--------|--------|
| Ctrl+P or `/ l...` | "Login to AgentFactory" | Device-code flow starts |
| Ctrl+P or `/ o...` | "Logout" | Token cleared, auth cleared |
| Click `[tools]` on status bar | Toggle chat mode | Button color changes, system message logged |
| Click `[model]` on status bar | Open model picker | Modal opens with provider → model selector |
| Enter (in import overlay) | Confirm import | Keys saved to `~/.config/agentfactory/config.json` |
| Esc (in overlays) | Close | Return to browse/chat |

---

## 6. GAPS
───────────────────────────────────────────────────────

**Planned for Wave 5.5+:**

1. **Harness reader** (`src/harness/reader.ts`) — load .ai/ context files, agent manifests
2. **Agent manifest parser** (`src/harness/manifest.ts`) — parse agent-manifest.json
3. **Project sessions** (GH issue #21) — group sessions by project/cwd, `/project resume`

**Not in scope:**

- OAuth/OIDC (device code is the auth method)
- Token refresh (user re-logs if expired)
- Rate limiting (API handles it)
- Credential encryption (token stored in plaintext at 0o600 mode)

---

## 7. TESTING INSTRUCTIONS
───────────────────────────────────────────────────────

### Unit Tests

```bash
npm test
# All 269 tests pass, including 21 new registry + UI tests
```

### Manual Smoke Test

1. **Start app**
   ```bash
   npm run dev
   ```

2. **Prompt bar** (Session tab, F1)
   - Type a 40-char sentence
   - Verify: text wraps to 2+ lines
   - Verify: `> ` prefix on first line only, `  ` on subsequent

3. **Status bar buttons**
   - Verify: `[tools]` button shown (accent bg) or `[chat]` (green bg)
   - Click `[tools]` → toggles to `[chat]` (green)
   - Click `[chat]` → toggles back to `[tools]` (accent)

4. **Login flow** (F5, Config tab)
   - Click `[→ Login]` button
   - Overlay appears with user code and URL
   - Countdown timer shows remaining seconds
   - Browser auto-opens to agentfactory.dev
   - (test with mock: just verify overlay closes on success message)

5. **Import keys** (F5, Config tab)
   - Click `[→ Import keys from tools]`
   - Overlay shows candidates (Anthropic from ~/.claude, or "no keys found")
   - Press Enter → keys saved
   - Verify: Config list shows keys as `[set]` instead of `(not set)`

6. **Model selector still works**
   - Click `[claude...]` on status bar
   - Modal opens with provider list
   - Select provider → model list appears
   - Select model → SessionPanel updates

---

## 8. REFERENCES
───────────────────────────────────────────────────────

- **API Contract**: `.ai/briefs/agentfactory-api-contract.md` (device code, auth endpoints)
- **CLI Tool Credentials**: `src/registry/import-keys.ts:14–25` (paths scanned)
- **Session Persistence**: `src/core/rollout.ts` (JSONL format, listing, resumption)
- **Cell Buffer API**: `src/tui/renderer/cell-buffer.ts` (write/fill row-indexed rendering)
- **GH Issue**: #21 (project sessions feature request)
