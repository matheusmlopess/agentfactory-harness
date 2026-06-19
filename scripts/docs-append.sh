#!/usr/bin/env bash
# docs-append.sh — register a doc into its folder master README.md.
#
# Appends a markdown link entry for <doc> to the README.md in the SAME folder
# (the "master" index), inserting it just before the "## Reference" section
# (or at end of file if there is none). Idempotent. Bumps the master's
# <!-- last-updated --> marker to today.
#
# Usage:
#   scripts/docs-append.sh <path/to/DOC.md> ["optional one-line summary"]
#
# Examples:
#   scripts/docs-append.sh docs/features/FEATURE-LOGGER-2026-06-09.md
#   scripts/docs-append.sh docs/reviews/REVIEW-FOO-2026-06-19.md "Why we did X"
set -euo pipefail

doc="${1:?usage: docs-append.sh <doc.md> [summary]}"
[ -f "$doc" ] || { echo "error: no such file: $doc" >&2; exit 1; }

dir="$(cd "$(dirname "$doc")" && pwd)"
base="$(basename "$doc")"
master="$dir/README.md"

[ "$base" = "README.md" ] && { echo "error: refusing to register a master into itself" >&2; exit 1; }
[ -f "$master" ] || { echo "error: no master README.md in $dir" >&2; exit 1; }

# Title = first H1; summary = first real prose line (skip markers/headings/rules)
title="$(grep -m1 '^# ' "$doc" | sed 's/^#[[:space:]]*//')"
summary="${2:-$(awk 'NR>1 && !/^<!--/ && !/^#/ && !/^---/ && NF {print; exit}' "$doc")}"
[ -n "$summary" ] || summary="$title"
entry="- [$base]($base) — $summary"

# Idempotent: skip if the doc is already linked
if grep -qF "($base)" "$master"; then
  echo "• already linked in ${master#"$PWD/"} — skipping"
  exit 0
fi

# Insert before "## Reference" (else append at EOF). awk -v avoids sed escaping pain.
tmp="$(mktemp)"
awk -v entry="$entry" '
  /^## Reference/ && !done { print entry; print ""; done=1 }
  { print }
  END { if (!done) print entry }
' "$master" > "$tmp" && mv "$tmp" "$master"

# Bump the master’s last-updated marker
sed -i "s/<!-- last-updated: [0-9-]* -->/<!-- last-updated: $(date +%F) -->/" "$master"

echo "✓ appended to ${master#"$PWD/"}:"
echo "    $entry"
