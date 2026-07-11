#!/usr/bin/env python3
"""
make_root_charts.py
Use PyROOT to generate professional plots from simulation CSVs.
Saves PNGs suitable for LaTeX.
"""
import os
import sys
sys.path.insert(0, "/opt/homebrew/lib/python3.9/site-packages")
import ROOT
ROOT.gROOT.SetBatch(True)

BASE = "sim/reports"
CIRCUIT_RES = "sim/circuit/results"
GEANT = "sim/geant4"
OUTDIR = "sim/reports/figures"
os.makedirs(OUTDIR, exist_ok=True)

def plot_waveforms():
    c = ROOT.TCanvas("c", "AFE Waveforms", 900, 600)
    c.Divide(1,2)
    colors = [ROOT.kBlue, ROOT.kRed, ROOT.kGreen+2, ROOT.kMagenta, ROOT.kOrange+7]
    for idx, npe in enumerate([1,3,10,30,100]):
        f = os.path.join(CIRCUIT_RES, f"wave_dual_n{npe}.csv")
        if not os.path.exists(f): continue
        g = ROOT.TGraph(f, "%lg %lg", "time v(OUT)")
        g.SetLineColor(colors[idx % len(colors)])
        g.SetTitle(f"NPE={npe}")
        c.cd(1)
        if idx==0: g.Draw("AL")
        else: g.Draw("L same")
    c.cd(2)
    # simple ToT summary graph
    g2 = ROOT.TGraph()
    ns = [1,3,10,30,100]
    tots = [8,19,35,49,68]
    for i,(n,t) in enumerate(zip(ns,tots)):
        g2.SetPoint(i, n, t)
    g2.SetMarkerStyle(20)
    g2.SetTitle("ToT vs NPE; NPE; ToT (ns)")
    g2.Draw("ALP")
    c.SaveAs(os.path.join(OUTDIR, "root_afe_tot.png"))
    print("Saved root_afe_tot.png")

def plot_detector():
    c = ROOT.TCanvas("d", "Detector", 800, 500)
    # Simple histogram from hits
    h = ROOT.TH1F("hpe", "Detected p.e. (stand-in);p.e.;Events", 50, 0, 400)
    hitsf = os.path.join(GEANT, "hits.csv")
    if os.path.exists(hitsf):
        with open(hitsf) as fh:
            next(fh)  # header
            for line in fh:
                parts = line.strip().split(",")
                if len(parts) > 7:
                    try:
                        h.Fill(float(parts[7]))
                    except: pass
    h.Draw()
    c.SaveAs(os.path.join(OUTDIR, "root_pe_hist.png"))
    print("Saved root_pe_hist.png")

if __name__ == "__main__":
    plot_waveforms()
    plot_detector()
    print("ROOT charts done.")
