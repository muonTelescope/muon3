#!/bin/bash
# memguard: run a command under a memory watchdog (macOS has no enforced ulimit -v).
#   tools/memguard.sh [-l LIMIT_MB] [-f FLOOR_MB] [-t TIMEOUT_S] -- command args...
# - refuses to start while available memory (free + inactive + speculative + purgeable) < FLOOR_MB
# - polls the RSS of the whole process tree every 0.5 s; SIGTERM then SIGKILL the tree above LIMIT_MB
# - optional wall-clock timeout; prints peak RSS on exit. Exit code 137 = killed by the guard.
LIMIT=1500 FLOOR=1200 TIMEOUT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -l) LIMIT=$2; shift 2 ;;
    -f) FLOOR=$2; shift 2 ;;
    -t) TIMEOUT=$2; shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[[ $# -eq 0 ]] && { echo "usage: $0 [-l MB] [-f MB] [-t s] -- cmd..." >&2; exit 2; }

avail_mb() {
  vm_stat | awk -v ps="$(sysctl -n hw.pagesize)" '
    /Pages free/ {f=$3} /Pages inactive/ {i=$3} /Pages speculative/ {s=$3} /Pages purgeable/ {p=$3}
    END {gsub(/\./,"",f); gsub(/\./,"",i); gsub(/\./,"",s); gsub(/\./,"",p); printf "%d", (f+i+s+p)*ps/1048576}'
}
tree_pids() { # $1 = root pid; prints the pid and all descendants
  local p kids; echo "$1"
  kids=$(pgrep -P "$1" 2>/dev/null)
  for p in $kids; do tree_pids "$p"; done
}
tree_rss_mb() {
  local pids; pids=$(tree_pids "$1" | paste -sd, -)
  [[ -z "$pids" ]] && { echo 0; return; }
  ps -o rss= -p "$pids" 2>/dev/null | awk '{s+=$1} END {printf "%d", s/1024}'
}

for _ in $(seq 1 120); do
  a=$(avail_mb); [[ $a -ge $FLOOR ]] && break
  echo "memguard: only ${a} MB available (< ${FLOOR} MB); waiting..." >&2; sleep 5
done
a=$(avail_mb); [[ $a -lt $FLOOR ]] && { echo "memguard: refusing to start, ${a} MB available" >&2; exit 75; }

"$@" &
PID=$!
PEAK=0 START=$SECONDS KILLED=""
while kill -0 "$PID" 2>/dev/null; do
  r=$(tree_rss_mb "$PID"); (( r > PEAK )) && PEAK=$r
  if (( r > LIMIT )); then KILLED="rss ${r} MB > ${LIMIT} MB"; fi
  if (( TIMEOUT > 0 && SECONDS - START > TIMEOUT )); then KILLED="timeout ${TIMEOUT} s"; fi
  if [[ -n "$KILLED" ]]; then
    PIDS=$(tree_pids "$PID"); kill -TERM $PIDS 2>/dev/null; sleep 2; kill -KILL $PIDS 2>/dev/null
    echo "memguard: killed ($KILLED)" >&2; wait "$PID" 2>/dev/null; echo "memguard: peak ${PEAK} MB" >&2; exit 137
  fi
  sleep 0.5
done
wait "$PID"; RC=$?
echo "memguard: peak ${PEAK} MB, exit ${RC}" >&2
exit $RC
