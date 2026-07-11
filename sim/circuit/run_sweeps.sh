#!/bin/bash
# Parametric runner for Muon3 AFE.
# Substitutes .param NPE= in a temp netlist for each value, runs ngspice (single run per .cir).
set -e
NGSPICE="/opt/homebrew/bin/ngspice"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTDIR="results"
PLOTDIR="plots"
mkdir -p "$OUTDIR" "$PLOTDIR"

SRC="afe_dual_threshold.cir"

echo "=== Muon3 ngspice AFE parametric sweeps ==="

for n in 1 3 10 30 100; do
  echo "  NPE=$n"
  TMP=$(mktemp /tmp/muon3_afe_XXXX.cir)
  # Substitute the .param NPE= line
  sed "s/^\.param NPE=.*/.param NPE=$n/" "$SRC" > "$TMP"
  $NGSPICE -b "$TMP" > /dev/null 2>&1 || true
  # Move/rename the written file
  if [ -f results/wave_dual.csv ]; then
    mv results/wave_dual.csv "results/wave_dual_n${n}.csv"
  fi
  rm -f "$TMP"
done

echo "Sweeps done."
ls -l results/*.csv 2>/dev/null | cat || echo "(no csv yet - check ngspice)"

echo "Running analysis..."
cd ..
source ../.venv/bin/activate || true
python circuit/analyze_muon3.py
echo "=== Complete ==="
ls -l circuit/plots/ 2>/dev/null || true
