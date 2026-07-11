#include "PanelRunAction.hh"

#include "G4Run.hh"
#include "G4RunManager.hh"
#include "G4SystemOfUnits.hh"
#include <iostream>

PanelRunAction::PanelRunAction() {}

void PanelRunAction::BeginOfRunAction(const G4Run* run) {
  G4int runID = run->GetRunID();
  std::cout << "=== Muon3 Panel Simulation Run " << runID << " starting ===" << std::endl;
}

void PanelRunAction::EndOfRunAction(const G4Run* run) {
  G4int events = run->GetNumberOfEvent();
  std::cout << "=== Run " << run->GetRunID() << " finished with " << events << " events ===" << std::endl;
  std::cout << "See muon_panel_hits.csv and photon_stats.txt for results." << std::endl;
}
