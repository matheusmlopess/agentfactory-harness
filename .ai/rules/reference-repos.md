# Rule: Reference Repos
<!-- version: 1.0.0 -->

When researching how to implement a feature, you MAY clone external repos into
`.refs/` for study. This is a local-only research mechanism — reference repos are
gitignored and must never influence the shipped codebase directly.

## The contract

| MUST | MUST NOT |
|------|----------|
| Clone to `.refs/<name>/` | Commit anything inside `.refs/` |
| Keep `.refs/` in `.gitignore` | Copy files from `.refs/` into `src/` |
| Use only for reading patterns | Reference `.refs/` paths in docs or plans |
| Remove after research ends (optional) | Treat any reference repo as a dependency |

## Procedure

```bash
# Clone a reference repo for research
git clone <url> .refs/<name>

# Read and grep inside it — never copy
grep -r "async function\*" .refs/<name>/src/
cat .refs/<name>/src/core/agent-loop.ts

# Distil the insight into your own implementation
# Delete when done (optional — gitignored either way)
rm -rf .refs/<name>
```

## Citing reference research

When reference repos inform a design decision, record the insight as prose in
the approved plan or feature doc — never as a file path. Use the form:

> Informed by reference research: accumulate `input_json_delta` strings and
> `JSON.parse` only at `content_block_stop` to avoid malformed partial JSON.

## Why

agentfactory-harness is a novel, independent project. Reference repos answer
"how does the community solve this?" without creating coupling. Keeping them in
`.refs/` and out of git makes the research boundary explicit.
