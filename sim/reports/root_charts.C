// root_charts.C
// Example ROOT macro to generate publication-quality charts from Muon3 simulation CSVs.
// Run in ROOT after `root -l` : .x root_charts.C
// Requires the CSV files in ../circuit/results/ or adjust paths.

#include "TGraph.h"
#include "TCanvas.h"
#include "TH1F.h"
#include "TStyle.h"
#include <fstream>
#include <vector>
#include <iostream>

void root_charts() {
    gStyle->SetOptStat(0);
    gStyle->SetPadGridX(1);
    gStyle->SetPadGridY(1);

    // Example: load one waveform and make ToT summary (simplified)
    // For full, read the wave_dual_n*.csv and hits.csv

    TCanvas* c1 = new TCanvas("c1", "Muon3 AFE ToT", 800, 600);
    // Placeholder graph (in real use fill from data)
    TGraph* g = new TGraph();
    double npe[5] = {1,3,10,30,100};
    double tot[5] = {8.2,19.5,35.1,48.6,68.2};
    for(int i=0; i<5; i++) g->SetPoint(i, npe[i], tot[i]);
    g->SetTitle("ToT vs NPE (from simulation);NPE;ToT (ns)");
    g->SetMarkerStyle(20);
    g->Draw("ALP");
    c1->SaveAs("muon3_tot_root.png");

    std::cout << "ROOT charts generated (example). Replace with full CSV parsing for production." << std::endl;
    // TODO: full CSV reader + TGraphErrors + histograms from hits.csv
}
