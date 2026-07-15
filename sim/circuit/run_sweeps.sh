#!/bin/bash
# Parametric runner for Muon3 AFE (rev 2).
# - fails loudly instead of hiding ngspice errors (rev 1 used `|| true`
#   and silently fell back to synthetic data downstream)
# - NPE sweep + low-threshold scan + cable comparison + HV model
set -euo pipefail
NGSPICE="$(command -v ngspice || echo /opt/homebrew/bin/ngspice)"
[ -x "$NGSPICE" ] || { echo "ERROR: ngspice not found"; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTDIR="results"
mkdir -p "$OUTDIR" plots
SRC="afe_dual_threshold.cir"

run_one () {
  local tmp; tmp=$(mktemp /tmp/muon3_afe_XXXX.cir)
  sed -E -e "$1" "$SRC" > "$tmp"
  local log; log=$(mktemp /tmp/muon3_afe_XXXX.log)
  if ! "$NGSPICE" -b "$tmp" > "$log" 2>&1; then
    echo "ERROR: ngspice failed for: $1"; tail -20 "$log"; exit 1
  fi
  grep -q "NGSPICE SINGLE RUN COMPLETE" "$log" || { echo "ERROR: run did not complete for: $1"; tail -20 "$log"; exit 1; }
  [ -f "$OUTDIR/wave_dual.csv" ] || { echo "ERROR: no output CSV for: $1"; exit 1; }
  mv "$OUTDIR/wave_dual.csv" "$OUTDIR/$2"
  rm -f "$tmp" "$log"
}

echo "=== Muon3 ngspice AFE parametric sweeps (rev 2) ==="

echo "-- NPE sweep --"
for n in 1 2 3 5 10 20 30 50 100; do
  echo "  NPE=$n"
  run_one "s/^\.param NPE=.*/.param NPE=$n/" "wave_dual_n${n}.csv"
done

echo "-- Low-threshold scan at NPE=30 --"
for vth in 1.789 1.778 1.767 1.745 1.712 1.690; do
  echo "  VTH_LOW=$vth"
  run_one "s/^\.param NPE=.*/.param NPE=30/; s/^\.param VTH_LOW=.*/.param VTH_LOW=$vth/" \
          "wave_dual_vth${vth}.csv"
done

echo "-- 50 cm cable comparison --"
"$NGSPICE" -b cable_50cm.cir > /tmp/muon3_cable.log 2>&1 || { echo "ERROR: cable run failed"; tail -20 /tmp/muon3_cable.log; exit 1; }
grep -q "CABLE MODEL RUN COMPLETE" /tmp/muon3_cable.log

echo "-- HV bias model (LT3482 / HCal S12572 primary) --"
"$NGSPICE" -b hv_lt3482.cir > /tmp/muon3_hv.log 2>&1 || { echo "ERROR: HV LT3482 run failed"; tail -20 /tmp/muon3_hv.log; exit 1; }
grep -q "HV LT3482 MODEL RUN COMPLETE" /tmp/muon3_hv.log

echo "Sweeps done:"
ls -l "$OUTDIR"/*.csv

echo "Running analysis..."
PY="$SCRIPT_DIR/../../.venv/bin/python"
[ -x "$PY" ] || PY=python3
"$PY" analyze_muon3.py
echo "=== Complete ==="
ls -l plots/
