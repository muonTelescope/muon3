#!/usr/bin/env python3
"""
Generate publication plots with ROOT (PyROOT or root -q macro).

Primary path: compile/run sim/reports/root_hcal_and_geant4.C via `root -b -q`.
Fallback: PyROOT if import works.

Run from physics/ root:
  python3 sim/reports/make_root_charts.py
  # or
  root -l -b -q 'sim/reports/root_hcal_and_geant4.C'
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


def run_root_macro() -> int:
    macro = ROOT_DIR / "sim/reports/root_hcal_and_geant4.C"
    if not macro.exists():
        print("Missing", macro, file=sys.stderr)
        return 1
    cmd = ["root", "-l", "-b", "-q", str(macro)]
    print("Running:", " ".join(cmd))
    return subprocess.call(cmd, cwd=str(ROOT_DIR))


def main() -> int:
    os.chdir(ROOT_DIR)
    # Prefer C++ macro (more reliable across ROOT installs than PyROOT path hacks)
    rc = run_root_macro()
    if rc != 0:
        print("ROOT macro failed with", rc, file=sys.stderr)
        return rc
    # List outputs
    for name in (
        "figures/hcal_inner_tile_edep.png",
        "figures/hcal_inner_tile_pe.png",
        "figures/hcal_inner_tile_yield_map.png",
        "figures/hcal_inner_tile_summary.png",
        "figures/root_hcal_combined.png",
        "figures/pe_spectrum.png",
        "figures/yield_map.png",
        "figures/root_muon3_analysis.png",
    ):
        p = ROOT_DIR / name
        print(("OK " if p.exists() else "MISSING "), name, p.stat().st_size if p.exists() else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
