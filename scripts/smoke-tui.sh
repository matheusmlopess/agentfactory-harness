#!/usr/bin/env bash
# TUI smoke test — drives the real full-screen app inside a detached tmux
# session and greps captured panes for expected strings. Grows a section per
# phase of the ui-consolidation plan. Requires: tmux, npx.
#
# Usage: scripts/smoke-tui.sh
set -euo pipefail

cd "$(dirname "$0")/.."

SESSION="factory-smoke-$$"
FAILURES=0

capture() { tmux capture-pane -pt "$SESSION"; }

send() { tmux send-keys -t "$SESSION" "$@"; sleep 0.7; }

check() {
  local desc="$1" pattern="$2"
  if capture | grep -qF -- "$pattern"; then
    echo "  ok: $desc"
  else
    echo "  FAIL: $desc (expected: $pattern)"
    FAILURES=$((FAILURES + 1))
  fi
}

cleanup() { tmux kill-session -t "$SESSION" 2>/dev/null || true; }
trap cleanup EXIT

echo "== Phase 0: startup chrome =="
tmux new-session -d -s "$SESSION" -x 120 -y 40 'npx tsx src/index.ts'

# Poll for the first render (tsx cold-start can take a while)
for _ in $(seq 1 60); do
  if capture | grep -qF " Session "; then break; fi
  sleep 1
done

check "tab bar shows Session tab"        " Session "
check "tab bar shows Orchestration tab"  " Orchestration "
check "tab bar shows Config tab"         " Config "
check "exit button rendered"             "✕ Quit"
check "status bar shows version"         "factory v$(node -p "require('./package.json').version")"
check "status bar shows NORMAL mode"     "[NORMAL]"

echo "== Phase 0: tab switching =="
send F5
check "F5 opens Config tab"              "API Providers"
send F6
check "F6 opens Logs tab (panel content, not tab label)" "Metrics"
send F1

echo "== Phase 4: help overlay + interface settings =="
send F6
send '?'
check "? opens the help overlay"          "Keyboard Shortcuts"
for _ in $(seq 1 16); do tmux send-keys -t "$SESSION" Down; sleep 0.15; done
sleep 0.7
check "help lists logs vim bindings (after scroll)" "Clear log buffer"
send Escape
send F5
check "Config shows the Interface section" "Interface"
check "Interface shows the theme setting"  "Theme"

# Quit cleanly
tmux send-keys -t "$SESSION" C-q
sleep 1

echo "== Phase 4: size-profile guard (60x20 terminal) =="
SESSION2="factory-smoke-guard-$$"
tmux new-session -d -s "$SESSION2" -x 60 -y 20 'npx tsx src/index.ts'
for _ in $(seq 1 60); do
  if tmux capture-pane -pt "$SESSION2" | grep -qF "Terminal too small"; then break; fi
  sleep 1
done
if tmux capture-pane -pt "$SESSION2" | grep -qF "Terminal too small"; then
  echo "  ok: guard screen shown below 80x24"
else
  echo "  FAIL: guard screen not shown at 60x20"
  FAILURES=$((FAILURES + 1))
fi
tmux send-keys -t "$SESSION2" C-q
sleep 1
tmux kill-session -t "$SESSION2" 2>/dev/null || true

if [ "$FAILURES" -gt 0 ]; then
  echo "smoke-tui: $FAILURES check(s) failed"
  exit 1
fi
echo "smoke-tui: all checks passed"
