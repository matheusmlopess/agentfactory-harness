# Rule: Reference Repos
<!-- version: 2.0.0 -->

Reference repos live **permanently** in `.refs/` as a shared research library.
They are gitignored and must never influence the shipped codebase directly.

## The contract

| MUST | MUST NOT |
|------|----------|
| Keep repos permanently in `.refs/<name>/` | Commit anything inside `.refs/` |
| Maintain `index.yml` per repo (every subfolder described) | Copy files from `.refs/` into `src/` |
| Read every `index.yml` before starting any plan | Delete repos after research |
| Use tool calls (Read, grep) to read inside repos during research | Treat any reference repo as a dependency |
| Cite `<repo>/<path>:<line>` in plan docs for every borrowed pattern | Reference `.refs/` absolute paths in docs |
| Update `index.yml` when a repo gains new folders | |

## Before every plan

At the start of every planning session, read all index files to survey available
reference material before designing an approach:

```bash
cat .refs/anthropics-claude-code/index.yml
cat .refs/claude-code-harness/index.yml
cat .refs/claw-code/index.yml
cat .refs/openclaude/index.yml
cat .refs/open-multi-agent/index.yml
```

## Adding a new reference repo

```bash
# Clone permanently — do not delete after research
git clone <url> .refs/<name>

# Write an index.yml describing every subfolder
# (copy the schema from any existing .refs/*/index.yml)
```

Then update Rule 9 in `.ai/adapters/claude/brief.md` to add the new read command
to the "Before every plan" list above.

## Researching inside a repo

```bash
# Read files directly — tool calls are allowed
cat .refs/<name>/src/core/agent-loop.ts

# Grep for patterns
grep -r "async function\*" .refs/<name>/src/
```

## Citing reference research

When a reference repo informs a design decision, cite the **repo-relative path and
line number** in the plan or feature doc. Use the form:

> `open-multi-agent/src/task/index.ts:87` — topological sort with cycle detection;
> adapted the same algorithm for our DAG executor.

Never use the `.refs/` absolute filesystem path in docs or plans.

## Why

agentfactory-harness is a novel, independent project. Reference repos answer
"how does the community solve this?" without creating coupling. Permanent residency
means the research library grows over time and every planning session can benefit
from it. Keeping it in `.refs/` and out of git keeps the boundary explicit.
