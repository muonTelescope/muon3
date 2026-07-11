#!/bin/bash
# Run Muon3 ngspice sweeps for AFE characterization.
# Requires ngspice installed.
set -e

OUTDIR="results"
mkdir -p "$OUTDIR" plots

echo "=== Muon3 AFE dual-threshold sweeps ==="

# Basic NPE family (1,3,10,30,100 p.e.)
for n in 1 3 10 30 100; do
  echo "  NPE=$n"
  ngspice -b -c "alterparam NPE=$n" -c "run" \
          -c "wrdata $OUTDIR/wave_dual_n${n}.csv v(OUT) v(CMPL) v(CMPH) v(INA)" \
          afe_dual_threshold.cir >/dev/null 2>&1 || true
done

# Threshold scan example (vary VTH_LOW around 3 p.e. for staircase)
echo "  Threshold scan stub..."
for thr in 1.75 1.70 1.68 1.65 1.60; do
  ngspice -b -c "alterparam VTH_LOW=$thr" -c "alterparam NPE=5" -c "run" \
          -c "wrdata $OUTDIR/thr_scan_${thr}.csv v(CMPL)" \
          afe_dual_threshold.cir >/dev/null 2>&1 || true
done

echo "Sweeps done. Output in $OUTDIR/"
echo "Run: python analyze_muon3.py"
