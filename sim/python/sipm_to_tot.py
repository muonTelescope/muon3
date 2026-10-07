#!/usr/bin/env python3
"""Interpolate an explicit NPE/ToT table. No built-in legacy amplifier fit.

Example:
  python hw/sim/characterize_tot.py
  python sim/python/sipm_to_tot.py hw/out/modular/analog/tot.csv --npe 36

A simulated CSV remains a simulation; it does not become measured calibration.
ToT estimates pulse size and is not a measurement of incident muon energy.
"""
import argparse
import csv
import numpy as np

def tot_from_npe(npe, calibration):
    """Interpolate within a provided table; reject extrapolation and invalid data."""
    with open(calibration, newline='') as f:
        rows=list(csv.DictReader(f))
    x=np.array([float(r['npe']) for r in rows])
    y=np.array([float(r['tot_ns']) for r in rows])
    if len(x)<2 or not np.all(np.isfinite(x)) or not np.all(np.isfinite(y)) or np.any(np.diff(x)<=0) or np.any(y<0):
        raise ValueError('Table needs ordered, unique NPE values and finite nonnegative ToT values')
    n=np.asarray(npe,dtype=float)
    if not np.all(np.isfinite(n)) or np.any(n<x[0]) or np.any(n>x[-1]):
        raise ValueError(f'Request outside calibration range {x[0]}..{x[-1]} p.e.')
    return np.interp(n,x,y)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('calibration',help='CSV with npe,tot_ns columns; identify whether simulated or measured')
    p.add_argument('--npe',type=float,default=36)
    a=p.parse_args()
    print(f'{a.npe:g} p.e. -> {float(tot_from_npe(a.npe,a.calibration)):.3f} ns (interpolated from {a.calibration})')
