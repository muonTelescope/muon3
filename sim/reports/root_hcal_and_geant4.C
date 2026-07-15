// root_hcal_and_geant4.C
// Publication-quality Geant4 analysis plots via ROOT 6.
//
// Usage (from physics/ repo root):
//   root -l -b -q 'sim/reports/root_hcal_and_geant4.C'
//
// Outputs (also mirrored under sim/geant4/plots/ and sim/reports/figures/):
//   figures/hcal_inner_tile_{edep,pe,yield_map,summary}.png
//   figures/root_hcal_combined.png
//   figures/pe_spectrum.png, yield_map.png (Muon3 hits if usable)

#include "TCanvas.h"
#include "TColor.h"
#include "TGraph2D.h"
#include "TH1D.h"
#include "TH2D.h"
#include "TLatex.h"
#include "TLegend.h"
#include "TPaveText.h"
#include "TStyle.h"
#include "TSystem.h"

#include <cmath>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Hit {
  double x = 0, y = 0, z = 0;
  double edep = 0;
  double npe = 0;
  double nprod = 0;
};

static std::vector<Hit> LoadHits(const char* path) {
  std::vector<Hit> hits;
  std::ifstream in(path);
  if (!in) {
    std::cerr << "WARN: cannot open " << path << "\n";
    return hits;
  }
  std::string line;
  std::getline(in, line);  // header
  while (std::getline(in, line)) {
    if (line.empty() || line[0] == '#') continue;
    // tolerate messy rows: need at least 8 comma fields
    std::vector<std::string> tok;
    std::stringstream ss(line);
    std::string cell;
    while (std::getline(ss, cell, ',')) tok.push_back(cell);
    if (tok.size() < 8) continue;
    Hit h;
    try {
      h.x = std::stod(tok[1]);
      h.y = std::stod(tok[2]);
      h.z = std::stod(tok[3]);
      h.edep = std::stod(tok[4]);
      h.nprod = std::stod(tok[5]);
      h.npe = std::stod(tok[7]);
    } catch (...) {
      continue;
    }
    // skip clearly corrupt rows
    if (!std::isfinite(h.edep) || !std::isfinite(h.npe)) continue;
    if (h.edep < 0 || h.edep > 100) continue;
    if (h.npe < 0 || h.npe > 1e6) continue;
    hits.push_back(h);
  }
  std::cout << "Loaded " << hits.size() << " hits from " << path << "\n";
  return hits;
}

static void StyleROOT() {
  gStyle->SetOptStat(0);
  gStyle->SetOptTitle(1);
  gStyle->SetTitleFont(42, "XYZ");
  gStyle->SetLabelFont(42, "XYZ");
  gStyle->SetTitleSize(0.045, "XYZ");
  gStyle->SetLabelSize(0.040, "XYZ");
  gStyle->SetTitleOffset(1.15, "Y");
  gStyle->SetPadLeftMargin(0.14);
  gStyle->SetPadRightMargin(0.12);
  gStyle->SetPadBottomMargin(0.12);
  gStyle->SetPadTopMargin(0.08);
  gStyle->SetHistLineWidth(2);
  gStyle->SetFrameLineWidth(1);
  gStyle->SetGridColor(kGray + 1);
  gStyle->SetGridStyle(3);
}

static void SaveAll(TCanvas* c, const char* basename) {
  // basename without extension, relative to physics/
  TString png = TString::Format("figures/%s.png", basename);
  TString png2 = TString::Format("sim/geant4/plots/%s.png", basename);
  TString png3 = TString::Format("sim/reports/figures/%s.png", basename);
  gSystem->mkdir("figures", kTRUE);
  gSystem->mkdir("sim/geant4/plots", kTRUE);
  gSystem->mkdir("sim/reports/figures", kTRUE);
  c->SaveAs(png);
  c->SaveAs(png2);
  c->SaveAs(png3);
  std::cout << "Wrote " << png << "\n";
}

static void AnnotateMean(TH1* h, const char* unit) {
  auto* pt = new TPaveText(0.55, 0.72, 0.88, 0.88, "NDC");
  pt->SetFillColor(kWhite);
  pt->SetFillStyle(1001);
  pt->SetBorderSize(1);
  pt->SetTextFont(42);
  pt->SetTextSize(0.035);
  pt->AddText(TString::Format("N = %d", (int)h->GetEntries()));
  pt->AddText(TString::Format("mean = %.2f %s", h->GetMean(), unit));
  pt->AddText(TString::Format("RMS  = %.2f %s", h->GetRMS(), unit));
  pt->Draw();
}

static void PlotHcal(const std::vector<Hit>& hits) {
  if (hits.empty()) return;

  double emax = 0, pmax = 0, xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
  double se = 0, sp = 0;
  int n = 0;
  for (const auto& h : hits) {
    if (h.edep <= 0 && h.npe <= 0) continue;
    emax = std::max(emax, h.edep);
    pmax = std::max(pmax, h.npe);
    xmin = std::min(xmin, h.x);
    xmax = std::max(xmax, h.x);
    ymin = std::min(ymin, h.y);
    ymax = std::max(ymax, h.y);
    se += h.edep;
    sp += h.npe;
    n++;
  }
  if (n == 0) return;
  emax = std::max(emax * 1.15, 1.0);
  pmax = std::max(pmax * 1.15, 10.0);

  // --- edep ---
  {
    auto* c = new TCanvas("c_edep", "HCal edep", 900, 650);
    c->SetGrid();
    auto* h = new TH1D("h_edep",
                       "sPHENIX Inner HCal tile (ROOT)  |  MIP energy deposit;E_{dep} (MeV);Events",
                       40, 0, emax);
    h->SetFillColor(TColor::GetColor("#2a9d8f"));
    h->SetLineColor(TColor::GetColor("#1d6f65"));
    for (const auto& hit : hits)
      if (hit.edep > 0) h->Fill(hit.edep);
    h->Draw("HIST");
    AnnotateMean(h, "MeV");
    auto* l = new TLatex(0.14, 0.94, "Hamamatsu S12572-33-015P  |  PDE=0.25  |  Geant4 hcal_tile");
    l->SetNDC();
    l->SetTextFont(42);
    l->SetTextSize(0.032);
    l->SetTextColor(kGray + 2);
    l->Draw();
    SaveAll(c, "hcal_inner_tile_edep");
  }

  // --- pe ---
  {
    auto* c = new TCanvas("c_pe", "HCal pe", 900, 650);
    c->SetGrid();
    auto* h = new TH1D("h_pe",
                       "sPHENIX Inner HCal tile (ROOT)  |  detected photoelectrons;N_{p.e.};Events",
                       40, 0, pmax);
    h->SetFillColor(TColor::GetColor("#264653"));
    h->SetLineColor(TColor::GetColor("#1a2f38"));
    for (const auto& hit : hits) h->Fill(hit.npe);
    h->Draw("HIST");
    AnnotateMean(h, "p.e.");
    auto* l = new TLatex(0.14, 0.94, "Effective yield: N_{pe}=E_{dep}#times10^{4}#times0.012#times0.25");
    l->SetNDC();
    l->SetTextFont(42);
    l->SetTextSize(0.032);
    l->SetTextColor(kGray + 2);
    l->Draw();
    SaveAll(c, "hcal_inner_tile_pe");
    // also legacy name used in paper for muon3 panel spectrum if we want reuse
  }

  // --- yield map ---
  {
    auto* c = new TCanvas("c_map", "HCal map", 850, 750);
    c->SetRightMargin(0.15);
    c->SetGrid();
    double mx0 = xmin - 5, mx1 = xmax + 5, my0 = ymin - 5, my1 = ymax + 5;
    auto* h2 = new TH2D("h_map",
                        "Inner HCal tile (ROOT)  |  mean E_{dep} vs impact;x (mm);y (mm)",
                        20, mx0, mx1, 20, my0, my1);
    auto* h2n = new TH2D("h_mapn", "n", 20, mx0, mx1, 20, my0, my1);
    for (const auto& hit : hits) {
      if (hit.edep <= 0) continue;
      h2->Fill(hit.x, hit.y, hit.edep);
      h2n->Fill(hit.x, hit.y, 1.0);
    }
    for (int ix = 1; ix <= h2->GetNbinsX(); ++ix) {
      for (int iy = 1; iy <= h2->GetNbinsY(); ++iy) {
        double nn = h2n->GetBinContent(ix, iy);
        if (nn > 0) h2->SetBinContent(ix, iy, h2->GetBinContent(ix, iy) / nn);
      }
    }
    h2->SetMinimum(0);
    h2->Draw("COLZ");
    h2->GetZaxis()->SetTitle("Mean E_{dep} (MeV)");
    SaveAll(c, "hcal_inner_tile_yield_map");
  }

  // --- 3-panel summary ---
  {
    auto* c = new TCanvas("c_sum", "HCal summary", 1400, 480);
    c->Divide(3, 1, 0.01, 0.01);

    c->cd(1);
    gPad->SetGrid();
    auto* he = new TH1D("hs_e", "E_{dep} (MeV);E_{dep} (MeV);Events", 30, 0, emax);
    he->SetFillColor(TColor::GetColor("#2a9d8f"));
    he->SetLineColor(kBlack);
    for (const auto& hit : hits)
      if (hit.edep > 0) he->Fill(hit.edep);
    he->Draw("HIST");

    c->cd(2);
    gPad->SetGrid();
    auto* hp = new TH1D("hs_p", "Scint. photons (est.);N_{#gamma};Events", 30, 0, 0);
    // dynamic range for photons
    double pmax2 = 0;
    for (const auto& hit : hits) pmax2 = std::max(pmax2, hit.nprod);
    hp->SetBins(30, 0, std::max(pmax2 * 1.1, 1.0));
    hp->SetFillColor(TColor::GetColor("#457b9d"));
    hp->SetLineColor(kBlack);
    for (const auto& hit : hits)
      if (hit.nprod > 0) hp->Fill(hit.nprod);
    hp->Draw("HIST");

    c->cd(3);
    gPad->SetGrid();
    auto* hd = new TH1D("hs_d", "Detected p.e.;N_{p.e.};Events", 30, 0, pmax);
    hd->SetFillColor(TColor::GetColor("#1d3557"));
    hd->SetLineColor(kBlack);
    for (const auto& hit : hits) hd->Fill(hit.npe);
    hd->Draw("HIST");

    c->cd(0);
    auto* title = new TLatex(0.02, 0.96,
                             TString::Format("Geant4 Inner HCal tile (ROOT)  N=%d  "
                                             "#LT E#GT=%.2f MeV  #LT p.e.#GT=%.1f  "
                                             "S12572 PDE=0.25",
                                             n, se / n, sp / n));
    title->SetNDC();
    title->SetTextFont(42);
    title->SetTextSize(0.035);
    title->Draw();

    SaveAll(c, "hcal_inner_tile_summary");
  }

  // combined 2x2 for paper convenience
  {
    auto* c = new TCanvas("c_comb", "HCal combined", 1100, 900);
    c->Divide(2, 2, 0.02, 0.02);

    c->cd(1);
    gPad->SetGrid();
    auto* he = new TH1D("hc_e", "E_{dep};E_{dep} (MeV);Events", 35, 0, emax);
    he->SetFillColor(TColor::GetColor("#2a9d8f"));
    for (const auto& hit : hits)
      if (hit.edep > 0) he->Fill(hit.edep);
    he->Draw("HIST");
    AnnotateMean(he, "MeV");

    c->cd(2);
    gPad->SetGrid();
    auto* hd = new TH1D("hc_d", "Detected p.e.;N_{p.e.};Events", 35, 0, pmax);
    hd->SetFillColor(TColor::GetColor("#264653"));
    for (const auto& hit : hits) hd->Fill(hit.npe);
    hd->Draw("HIST");
    AnnotateMean(hd, "p.e.");

    c->cd(3);
    gPad->SetRightMargin(0.14);
    gPad->SetGrid();
    double mx0 = xmin - 5, mx1 = xmax + 5, my0 = ymin - 5, my1 = ymax + 5;
    auto* h2 = new TH2D("hc_map", "Mean E_{dep};x (mm);y (mm)", 18, mx0, mx1, 18, my0, my1);
    auto* hn = new TH2D("hc_n", "n", 18, mx0, mx1, 18, my0, my1);
    for (const auto& hit : hits) {
      if (hit.edep <= 0) continue;
      h2->Fill(hit.x, hit.y, hit.edep);
      hn->Fill(hit.x, hit.y, 1);
    }
    for (int ix = 1; ix <= 18; ++ix)
      for (int iy = 1; iy <= 18; ++iy) {
        double nn = hn->GetBinContent(ix, iy);
        if (nn > 0) h2->SetBinContent(ix, iy, h2->GetBinContent(ix, iy) / nn);
      }
    h2->Draw("COLZ");

    c->cd(4);
    gPad->SetGrid();
    auto* hpe = new TH2D("hc_corr", "p.e. vs E_{dep};E_{dep} (MeV);N_{p.e.}", 25, 0, emax, 25, 0, pmax);
    for (const auto& hit : hits)
      if (hit.edep > 0) hpe->Fill(hit.edep, hit.npe);
    hpe->Draw("COLZ");

    SaveAll(c, "root_hcal_combined");
  }
}

static void PlotMuon3IfAny(const std::vector<Hit>& hits) {
  if (hits.size() < 20) return;
  double pmax = 0, emax = 0;
  double xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
  int n = 0;
  for (const auto& h : hits) {
    if (h.edep <= 0 && h.npe <= 0) continue;
    pmax = std::max(pmax, h.npe);
    emax = std::max(emax, h.edep);
    xmin = std::min(xmin, h.x);
    xmax = std::max(xmax, h.x);
    ymin = std::min(ymin, h.y);
    ymax = std::max(ymax, h.y);
    n++;
  }
  if (n < 20) return;
  pmax = std::max(pmax * 1.1, 10.0);
  emax = std::max(emax * 1.1, 1.0);

  {
    auto* c = new TCanvas("m3_pe", "Muon3 pe", 900, 650);
    c->SetGrid();
    auto* h = new TH1D("m3h_pe", "Muon3 panel (ROOT)  |  detected p.e.;N_{p.e.};Events", 50, 0, pmax);
    h->SetFillColor(TColor::GetColor("#457b9d"));
    h->SetLineColor(kBlack);
    for (const auto& hit : hits)
      if (hit.npe > 0) h->Fill(hit.npe);
    h->Draw("HIST");
    AnnotateMean(h, "p.e.");
    SaveAll(c, "pe_spectrum");
    SaveAll(c, "root_pe_hist");
  }

  {
    auto* c = new TCanvas("m3_map", "Muon3 map", 850, 750);
    c->SetRightMargin(0.15);
    c->SetGrid();
    auto* h2 = new TH2D("m3_ymap", "Muon3 panel (ROOT)  |  mean p.e. vs position;x (mm);y (mm)",
                        20, xmin - 5, xmax + 5, 20, ymin - 5, ymax + 5);
    auto* hn = new TH2D("m3_yn", "n", 20, xmin - 5, xmax + 5, 20, ymin - 5, ymax + 5);
    for (const auto& hit : hits) {
      if (hit.npe <= 0) continue;
      h2->Fill(hit.x, hit.y, hit.npe);
      hn->Fill(hit.x, hit.y, 1);
    }
    for (int ix = 1; ix <= 20; ++ix)
      for (int iy = 1; iy <= 20; ++iy) {
        double nn = hn->GetBinContent(ix, iy);
        if (nn > 0) h2->SetBinContent(ix, iy, h2->GetBinContent(ix, iy) / nn);
      }
    h2->Draw("COLZ");
    h2->GetZaxis()->SetTitle("Mean N_{p.e.}");
    SaveAll(c, "yield_map");
    SaveAll(c, "root_yield_hist");
  }

  {
    auto* c = new TCanvas("m3_comb", "Muon3 combined", 1100, 900);
    c->Divide(2, 2);
    c->cd(1);
    gPad->SetGrid();
    auto* he = new TH1D("m3e", "E_{dep};MeV;Events", 40, 0, emax);
    he->SetFillColor(TColor::GetColor("#2a9d8f"));
    for (const auto& hit : hits)
      if (hit.edep > 0) he->Fill(hit.edep);
    he->Draw("HIST");
    c->cd(2);
    gPad->SetGrid();
    auto* hp = new TH1D("m3p", "Detected p.e.;p.e.;Events", 40, 0, pmax);
    hp->SetFillColor(TColor::GetColor("#264653"));
    for (const auto& hit : hits)
      if (hit.npe > 0) hp->Fill(hit.npe);
    hp->Draw("HIST");
    c->cd(3);
    gPad->SetGrid();
    auto* h2 = new TH2D("m3c", "p.e. vs E_{dep};MeV;p.e.", 30, 0, emax, 30, 0, pmax);
    for (const auto& hit : hits)
      if (hit.edep > 0 && hit.npe > 0) h2->Fill(hit.edep, hit.npe);
    h2->Draw("COLZ");
    c->cd(4);
    gPad->SetGrid();
    auto* hx = new TH1D("m3x", "Impact x;x (mm);Events", 30, xmin - 5, xmax + 5);
    hx->SetFillColor(TColor::GetColor("#e9c46a"));
    for (const auto& hit : hits)
      if (hit.edep > 0) hx->Fill(hit.x);
    hx->Draw("HIST");
    SaveAll(c, "root_muon3_analysis");
    SaveAll(c, "muon3_real_geant4");
  }
}

void root_hcal_and_geant4() {
  StyleROOT();
  auto hcal = LoadHits("sim/geant4/hcal_tile_hits.csv");
  PlotHcal(hcal);

  // Prefer cleanest muon3 file
  auto m3 = LoadHits("sim/geant4/hits_fresh.csv");
  if (m3.size() < 50) m3 = LoadHits("sim/geant4/hits_final.csv");
  if (m3.size() < 50) m3 = LoadHits("sim/geant4/hits.csv");
  PlotMuon3IfAny(m3);

  std::cout << "ROOT Geant4 plots complete.\n";
}
