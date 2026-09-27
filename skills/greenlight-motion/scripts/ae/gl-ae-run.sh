#!/bin/bash
# GreenLight Dash — run an agent-written ExtendScript in the user's After Effects (macOS).
#
#   gl-ae-run.sh <script.jsx> [--log <file>] [--timeout <seconds>]
#   gl-ae-run.sh --probe                  # only check that AE is running and accepting scripts
#
# What it does:
#   1. Checks After Effects is running (it never launches it — ask the user to open AE).
#   2. Probes that AE executes scripts. A probe that writes nothing means a modal alert is open
#      (or AE is still starting): stop and ask the user to click OK — do not retry in a loop.
#   3. Runs the script via DoScriptFile with scripts/ae/gl-ae-prelude.jsx loaded first (global GL,
#      GL_LOG_PATH set to the log file), under an explicit AppleScript timeout.
#   4. Prints the log. DoScriptFile never returns your script's value, so the log is the result.
#      A log without the final "END" line means the script aborted.
#
# Exit codes: 0 ok · 1 usage · 2 AE not accepting scripts · 3 AE not running · 4 script reported ERROR · 5 aborted (no END)
# Override the app with AE_APP="Adobe After Effects 2026".

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PRELUDE="$HERE/gl-ae-prelude.jsx"
SCRIPT="" LOG="" TIMEOUT=600 PROBE_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --log) LOG="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --probe) PROBE_ONLY=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) SCRIPT="$1"; shift ;;
  esac
done
if [ "$PROBE_ONLY" = 0 ] && { [ -z "$SCRIPT" ] || [ ! -f "$SCRIPT" ]; }; then
  echo "usage: gl-ae-run.sh <script.jsx> [--log file] [--timeout seconds] | --probe" >&2; exit 1
fi

# Newest installed release (Beta excluded) unless AE_APP is set.
if [ -z "${AE_APP:-}" ]; then
  AE_DIR="$(ls -d /Applications/Adobe\ After\ Effects\ 20* 2>/dev/null | grep -v -i beta | sort -V | tail -1)"
  AE_APP="${AE_DIR##*/}"
fi
if [ -z "$AE_APP" ]; then echo "After Effects is not installed in /Applications." >&2; exit 3; fi
if ! pgrep -x "After Effects" >/dev/null; then
  echo "After Effects is not running. Ask the user to open $AE_APP and wait for the normal UI." >&2; exit 3
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/gl-ae.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
js_str() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
as_str() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

run_file() { # $1 = jsx path, $2 = timeout seconds
  perl -e 'alarm shift; exec @ARGV' "$(( $2 + 30 ))" osascript \
    -e "with timeout of $2 seconds" \
    -e "tell application \"$(as_str "$AE_APP")\" to DoScriptFile POSIX file \"$(as_str "$1")\"" \
    -e "end timeout" 2>&1
}

# Probe: writes a constant string only, so it can never raise an alert itself.
PROBE_OUT="$TMP/probe.txt"
printf 'var f = new File("%s"); f.open("w"); f.write("ok"); f.close();\n' "$(js_str "$PROBE_OUT")" > "$TMP/probe.jsx"
run_file "$TMP/probe.jsx" 20 >/dev/null
if [ ! -s "$PROBE_OUT" ]; then
  echo "After Effects is running but not executing scripts. A modal alert is probably open (or AE is still starting)." >&2
  echo "Ask the user to dismiss it (click OK) and try once more — do not loop." >&2
  exit 2
fi
if [ "$PROBE_ONLY" = 1 ]; then echo "After Effects ($AE_APP) is accepting scripts."; exit 0; fi

abspath() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$(pwd)" "$1" ;; esac; }
SCRIPT="$(abspath "$SCRIPT")"   # AE resolves relative paths against its own folder
[ -z "$LOG" ] && LOG="${SCRIPT%.*}.log"
LOG="$(abspath "$LOG")"
rm -f "$LOG"
{
  printf 'var GL_LOG_PATH = "%s";\n' "$(js_str "$LOG")"
  printf '$.evalFile(new File("%s"));\n' "$(js_str "$PRELUDE")"
  printf 'try { $.evalFile(new File("%s")); } catch (e) { GL.log("ERROR", e); }\n' "$(js_str "$SCRIPT")"
  printf 'GL.log("END");\n'
} > "$TMP/wrapper.jsx"

OUT="$(run_file "$TMP/wrapper.jsx" "$TIMEOUT")"
[ -f "$LOG" ] && cat "$LOG"
if [ -n "$OUT" ] && [ "$OUT" != "0" ] && [ "$OUT" != "1" ]; then echo "osascript: $OUT" >&2; fi
if ! grep -q '^END$' "$LOG" 2>/dev/null; then
  echo "Script aborted before END (uncaught error — an alert may now be open in AE; ask the user to click OK)." >&2; exit 5
fi
if grep -q '^ERROR ' "$LOG"; then exit 4; fi
exit 0
