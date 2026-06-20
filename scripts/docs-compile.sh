#!/usr/bin/env bash
# docs-compile.sh — build a folder's MEMORIAL.md: one descriptive compendium that
# concatenates EVERY doc in the folder, ordered by creation date, with an Index and a
# Glossary link. Each section keeps a link/wikilink back to its source.
#
# It is a deterministic full REBUILD, which means:
#   • idempotent — re-running produces the same file (no duplicates)
#   • "append the latest" — a newly created doc is picked up automatically
#   • "check if already there" — one section per source file, never doubled
#   • "check the order" — sections are re-sorted by creation date every run
#
# Creation date per doc is taken from its `<!-- date: -->` marker, else the git
# first-commit date, else a YYYY-MM-DD in the filename.
#
# Usage:
#   scripts/docs-compile.sh <folder>            # e.g. docs/features
#   scripts/docs-compile.sh <path/to/DOC.md>    # compiles the doc's parent folder
#   scripts/docs-compile.sh --clean <folder>    # REMOVE that folder's MEMORIAL.md (revert)
set -euo pipefail

clean=0
if [ "${1:-}" = "--clean" ]; then clean=1; shift; fi

arg="${1:?usage: docs-compile.sh [--clean] <folder|doc.md>}"
if [ -d "$arg" ]; then dir="$arg"; else dir="$(dirname "$arg")"; fi
dir="${dir%/}"
[ -d "$dir" ] || { echo "error: no such folder: $dir" >&2; exit 1; }

if [ "$clean" = 1 ]; then
  if [ -f "$dir/MEMORIAL.md" ]; then rm -f "$dir/MEMORIAL.md"; echo "✓ removed $dir/MEMORIAL.md"; else echo "• no MEMORIAL.md in $dir"; fi
  exit 0
fi

out="$dir/MEMORIAL.md"
folder="$(basename "$dir")"
# relative path from this folder up to the central glossary
glossary_rel="../documentation/GLOSSARY.md"
[ "$folder" = "documentation" ] && glossary_rel="GLOSSARY.md"

doc_date() {
  local f="$1" d
  d="$(grep -m1 '<!-- date:' "$f" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)"
  [ -n "$d" ] && { echo "$d"; return; }
  d="$(git -C "$dir" log --diff-filter=A --format=%ad --date=short -- "$(basename "$f")" 2>/dev/null | tail -1 || true)"
  [ -n "$d" ] && { echo "$d"; return; }
  d="$(basename "$f" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)"
  echo "${d:-9999-99-99}"
}
doc_title()   { grep -m1 '^# ' "$1" | sed 's/^#[[:space:]]*//' ; }
# first real prose line: skip markers/headings/rules/blockquotes/fences/tables/box-drawing
doc_summary() {
  perl -CSD -ne '
    next if $. == 1;
    next if /^<!--/ || /^#/ || /^---/ || /^\s*>/ || /^\s*```/ || /^\s*\|/;
    next if /^\s*[\x{2500}-\x{257F}]/;     # box-drawing block
    next unless /\p{L}/;                    # must contain a letter
    s/^\s+//; s/\s+$//;
    print; last;
  ' "$1"
}
doc_body()    { awk 'seen{print} /^# /{seen=1}' "$1" ; }   # everything after the first H1

# collect (date \t file), sorted by date then name
list="$(mktemp)"
for f in "$dir"/*.md; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in MEMORIAL.md|README.md) continue;; esac
  printf '%s\t%s\n' "$(doc_date "$f")" "$f"
done | sort -t"$(printf '\t')" -k1,1 -k2,2 > "$list"

count="$(wc -l < "$list" | tr -d ' ')"
[ "$count" -gt 0 ] || { echo "no docs to compile in $dir"; rm -f "$list"; exit 0; }

maxdate="$(cut -f1 "$list" | sort | tail -1)"
# preserve the memorial's creation date if it already exists, else today
created="$(grep -m1 '<!-- date:' "$out" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)"
created="${created:-$(date +%F)}"

# Title-case-ish folder name for the heading
ftitle="$(echo "$folder" | tr '[:lower:]' '[:upper:]')"

{
  echo "<!-- version: 1.0.0 -->"
  echo "<!-- classification: SUMMARY -->"
  echo "<!-- date: $created -->"
  echo "<!-- last-updated: $maxdate -->"
  echo "<!-- status: ACTIVE -->"
  echo "<!-- generated-by: scripts/docs-compile.sh -->"
  echo
  echo "# $ftitle — Memorial (Descriptive Compendium)"
  echo
  echo "> **Auto-generated** by \`scripts/docs-compile.sh\` — **do not edit by hand**."
  echo "> Edit the source docs in \`$folder/\` and re-run the script."
  echo "> Documents: **$count** · ordered by creation date · each section links its source."
  echo
  echo "<a id=\"index\"></a>"
  echo "## Index"
  echo
  i=0
  while IFS="$(printf '\t')" read -r d f; do
    i=$((i+1)); b="$(basename "$f")"
    printf '%s. [%s](#d%s) — `%s` — %s · [[%s]]\n' "$i" "$(doc_title "$f")" "$i" "$d" "$(doc_summary "$f")" "${b%.md}"
  done < "$list"
  echo
  echo "## Glossary"
  echo
  echo "Term & acronym definitions: [GLOSSARY]($glossary_rel) · [[GLOSSARY]]"
  echo
  echo "---"
  echo
  i=0
  while IFS="$(printf '\t')" read -r d f; do
    i=$((i+1)); b="$(basename "$f")"
    echo "<a id=\"d$i\"></a>"
    echo
    echo "## $i · $d · $(doc_title "$f")"
    echo
    echo "Source: [$b]($b) · [[${b%.md}]]  ·  [↑ Index](#index)"
    echo
    doc_body "$f"
    echo
    echo "---"
    echo
  done < "$list"
} > "$out"

rm -f "$list"
echo "✓ compiled $out ($count docs, $created → $maxdate)"
