<!-- version: 1.0.0 -->
# Gap–Issue Relationship Matrix
<!-- version: 1.0.0 -->

> Cross-reference between the 10 skill-pipeline gaps (from `docs/FEATURE-AGENTFACTORY-SKILL-PIPELINE.md`)
> and all open issues across both repos as of 2026-04-28.

---

## Repos in scope

| Repo | Abbrev | Issues checked |
|------|--------|----------------|
| `matheusmlopess/agentfactory-harness` | **H** | #6, #8, #9 |
| `matheusmlopess/AgentFactory` | **AF** | #132–#145 |

---

## Relationship legend

| Symbol | Meaning |
|--------|---------|
| 🔴 Strong | Same root cause or explicitly the same feature — one fix resolves both |
| 🟡 Partial | Same domain or adjacent concern — a fix for one reduces but does not close the other |
| ⬜ Independent | No meaningful overlap — gap must be addressed on its own |

---

## Matrix: 10 Gaps × Open Issues

| Gap | Description | H#6 | H#8 | H#9 | AF#132 | AF#134 | AF#137 | AF#138 | AF#139 | AF#140 | AF#141 | AF#145 |
|-----|-------------|-----|-----|-----|--------|--------|--------|--------|--------|--------|--------|--------|
| GAP-1 | No skill scaffold command | | | 🔴 | | | | | | | | 🔴 |
| GAP-2 | No SKILL.md template generator | | | 🔴 | | | | | | | | 🔴 |
| GAP-3 | No skill format validation | | | 🔴 | 🟡 | 🔴 | | | 🔴 | | | 🔴 |
| GAP-4 | No skill listing command | | | 🔴 | | | 🟡 | | | | | 🔴 |
| GAP-5 | No versioning enforcement | | | 🔴 | | | | 🟡 | | | | 🔴 |
| GAP-6 | No skill test scaffold | | | 🔴 | | | | | 🟡 | | | 🔴 |
| GAP-7 | No governance rule | | | 🔴 | | | | | | | | 🔴 |
| GAP-8 | No skill-manifest.json derivation | | | 🔴 | | 🔴 | | | | | | 🔴 |
| GAP-9 | No project-index integration | | | 🔴 | | | | | | | | 🔴 |
| GAP-10 | No rollback on import failure | | | 🔴 | | | | | | 🟡 | 🟡 | 🔴 |

> Issues not in the table (H#6, AF#133, AF#135, AF#136, AF#142, AF#143, AF#144): no meaningful overlap with any of the 10 gaps — see §4.

---

## Per-gap breakdown

### GAP-1 — No skill scaffold command
**`agentfactory-gen create-skill <name> --in <agent>`**

| Issue | Rel | Reason |
|-------|-----|--------|
| H#9 | 🔴 | Direct parent — filed to track this exact gap |
| AF#145 | 🔴 | Cross-repo mirror of H#9 filed in agentfactory |
| (all others) | ⬜ | No existing issue requests a `create-skill` command |

**Verdict: Independent from all existing issues except the tracker issues we filed.**

---

### GAP-2 — No SKILL.md template generator

| Issue | Rel | Reason |
|-------|-----|--------|
| H#9 | 🔴 | Sub-item of H#9 (covered under GAP-1's proposed fix) |
| AF#145 | 🔴 | Mirror |
| (all others) | ⬜ | No issue requests template generation |

**Verdict: Independent. Naturally bundled with GAP-1 (`create-skill` should output a template).**

---

### GAP-3 — No skill format validation

| Issue | Rel | Reason |
|-------|-----|--------|
| AF#134 | 🔴 | **Same root cause.** #134 reports that `triggers:` in SKILL.md frontmatter is not propagated to the compiled brief after `import-skill + brief`. This is a direct symptom of the CLI not parsing SKILL.md frontmatter at all — exactly the same gap as GAP-3. A fix for #134 (parse frontmatter on import) also closes GAP-3 (validate frontmatter on import). |
| AF#139 | 🔴 | #139 requests promoting `skill-completeness-check.py` to a CLI subcommand. That external script is precisely what GAP-3 proposes as `agentfactory-gen validate-skill`. The feature is already partially built — it just needs to be wired into the CLI. |
| AF#132 | 🟡 | #132 reports `audit` exits 1 on untracked files — a related quality issue around when/how the CLI validates agent state. Not the same as skill content validation, but shares the theme of "tooling that reports problems accurately". |
| H#9 | 🔴 | Tracker |

**Verdict: Strongly overlaps AF#134 and AF#139. GAP-3 can be closed by combining the #134 frontmatter-parsing fix with the #139 CLI wiring. No new issue needed — comment/link on both.**

---

### GAP-4 — No skill listing command

| Issue | Rel | Reason |
|-------|-----|--------|
| AF#137 | 🟡 | #137 requests `agentfactory-gen status` — a command showing deployed agents, their versions, and audit health. A `list-skills` subcommand could live as a sub-view of `status`, or the `status` output could include skills. They address adjacent discoverability needs: #137 is agent-level, GAP-4 is skill-level within an agent. |
| H#9 / AF#145 | 🔴 | Trackers |
| (all others) | ⬜ | No overlap |

**Verdict: Partially covered by AF#137. Could be implemented as `status --skills` or as a standalone subcommand. Either way, the #137 implementation should account for GAP-4 scope.**

---

### GAP-5 — No skill versioning enforcement

| Issue | Rel | Reason |
|-------|-----|--------|
| AF#138 | 🟡 | #138 requests `agentfactory-gen upgrade` for in-place agent updates without losing local customizations. The upgrade workflow would inherently require version comparison between the incoming agent and the installed one — the same logic GAP-5 needs for skill re-imports. The implementations are adjacent: #138 is agent-level upgrades, GAP-5 is skill-level version checking on `import-skill`. |
| H#9 / AF#145 | 🔴 | Trackers |
| (all others) | ⬜ | No overlap |

**Verdict: Partially covered by AF#138 (shared version-comparison logic). GAP-5 should be mentioned in the #138 implementation so skill-level versioning reuses the same mechanism.**

---

### GAP-6 — No skill test scaffold

| Issue | Rel | Reason |
|-------|-----|--------|
| AF#139 | 🟡 | #139 promotes `skill-completeness-check.py` and `harness-doctor.sh` to CLI subcommands. `skill-completeness-check` validates structural completeness (files present, frontmatter fields filled). GAP-6 goes further: a smoke-test runner that actually invokes the skill and asserts on output. Overlapping concern (both are quality gates) but different implementation scope. |
| H#9 / AF#145 | 🔴 | Trackers |
| (all others) | ⬜ | No overlap |

**Verdict: Partially covered by AF#139 for static checks. The smoke-test runner (GAP-6 core ask) is independent and not addressed by any existing issue.**

---

### GAP-7 — No governance rule for skill creation

| Issue | Rel | Reason |
|-------|-----|--------|
| H#9 | 🔴 | Tracker |
| AF#145 | 🔴 | Mirror |
| (all others) | ⬜ | Governance rules are harness-side; no AgentFactory issue touches this |

**Verdict: Fully independent. This is a harness-side concern (adding Rule 10 to `.ai/rules/`). No existing issue in either repo overlaps. Must be addressed separately in the harness.**

---

### GAP-8 — import-skill does not derive skill-manifest.json

| Issue | Rel | Reason |
|-------|-----|--------|
| AF#134 | 🔴 | **Same root cause as GAP-3.** If `import-skill` does not parse SKILL.md frontmatter (evidenced by #134: triggers not propagated), it also cannot auto-derive `skill-manifest.json` from that frontmatter. A #134 fix that adds full frontmatter parsing to `import-skill` simultaneously enables GAP-8's proposed derivation step. |
| H#9 / AF#145 | 🔴 | Trackers |
| (all others) | ⬜ | No overlap |

**Verdict: Resolves together with GAP-3 via AF#134. Both gaps share the same fix: parse SKILL.md frontmatter in `import-skill`.**

---

### GAP-9 — No project-index integration

| Issue | Rel | Reason |
|-------|-----|--------|
| H#9 | 🔴 | Tracker |
| AF#145 | 🔴 | Mirror |
| (all others) | ⬜ | `project-index.yml` is a harness-specific construct; no AgentFactory issue references it |

**Verdict: Fully independent. Harness-side concern only. Must be addressed by adding project-index patching to either `import-skill` (in agentfactory-gen) or as a post-import hook in the harness.**

---

### GAP-10 — No rollback on import-skill failure

| Issue | Rel | Reason |
|-------|-----|--------|
| AF#141 | 🟡 | #141 reports that `audit` runs after unpack, meaning malicious content registers before detection. Both #141 and GAP-10 are about the same `import` step lacking safety guarantees — #141 is about pre-registration inspection ordering, GAP-10 is about post-failure cleanup. They would likely be fixed together as part of an atomic import redesign. |
| AF#140 | 🟡 | #140 requests `import --dry-run`. A dry-run mode and atomic-write rollback are complementary safety features for the same `import` command. Implementing one opens the door to the other. |
| H#9 / AF#145 | 🔴 | Trackers |
| (all others) | ⬜ | No overlap |

**Verdict: Partially related to AF#141 and AF#140. All three (GAP-10, #141, #140) should be tackled in a coordinated `import` safety overhaul.**

---

## Issues with NO gap overlap

These open issues address concerns orthogonal to the 10 skill-pipeline gaps:

| Issue | Topic | Why independent |
|-------|-------|-----------------|
| H#6 | Security & design audit Wave 0-2 | Harness source code security (bash exec, path traversal in tools) — not CLI tooling |
| H#8 | Security & design audit 2026-04-27 | Same as H#6, more recent |
| AF#133 | `--version` flag missing | CLI metadata issue, no skill interaction |
| AF#135 | `import --project-root` conflict check bug | Import routing bug, not skill content or lifecycle |
| AF#136 | `wrap --out` undiscoverable | Output UX issue for wrap command |
| AF#142 | `scripts/` execute without sandbox | Import security (agent scripts), not skill authoring |
| AF#143 | `--project-root` path traversal | CLI input validation, not skill authoring |
| AF#144 | No ZIP checksum on import | Import provenance security |

---

## Consolidation opportunities

Three fixing clusters emerge from the matrix:

### Cluster A — Frontmatter parsing (closes GAP-3 + GAP-8 + AF#134)
All three share the root cause: `import-skill` does not parse SKILL.md frontmatter.
One PR in agentfactory-gen that adds full frontmatter parsing to `import-skill` closes:
- AF#134 (triggers not propagated to brief)
- GAP-3 (no format validation — validate while parsing)
- GAP-8 (no skill-manifest.json derivation — derive from parsed frontmatter)

### Cluster B — Discoverability (closes GAP-4 + AF#137 partially)
`agentfactory-gen status` (AF#137) and `list-skills` (GAP-4) both address "what is deployed."
Implement as a single `status` command with `--skills` detail flag.

### Cluster C — Import safety (closes GAP-10 + informs AF#140 + AF#141)
An atomic-write redesign of `import-skill`/`import` addresses:
- GAP-10 (rollback on failure via temp-file + `os.replace()`)
- AF#141 (audit-before-register ordering)
- AF#140 (dry-run mode is trivially composable once import is atomic)

### Standalone gaps (no existing overlap)
Must be implemented fresh with no existing issue to piggyback:

| Gap | Effort | Notes |
|-----|--------|-------|
| GAP-1 | Medium | New `create-skill` command — mirrors `deploy` pattern |
| GAP-2 | Low | Bundled with GAP-1 (template output) |
| GAP-5 | Low | Add hash-comparison check to `import-skill` |
| GAP-6 | High | Smoke-test runner — requires sandbox invocation design |
| GAP-7 | Low | Harness-only: add Rule 10 to `.ai/rules/` |
| GAP-9 | Low | Harness-only: patch `project-index.yml` after import |

---

*Matrix built from: `docs/FEATURE-AGENTFACTORY-SKILL-PIPELINE.md` (10 gaps) ×*
*open issues in `agentfactory-harness` (#6, #8, #9) and `AgentFactory` (#132–#145) as of 2026-04-28.*
