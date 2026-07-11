#include "PanelEventAction.hh"

#include "G4Event.hh"
#include "G4EventManager.hh"
#include <fstream>
#include <iostream>

static std::ofstream gHitsFile("muon_panel_hits.csv");
static std::ofstream gPhotonFile("photon_stats.txt", std::ios::app);

PanelEventAction::PanelEventAction() {
  if (gHitsFile.tellp() == 0) {
    gHitsFile << "event,x_mm,y_mm,z_mm,edep_MeV,photons_prod,photons_shifted,photons_detected\n";
  }
}

void PanelEventAction::BeginOfEventAction(const G4Event* event) {
  fEdepScint = 0.;
  fPhotonsProduced = 0;
  fPhotonsShifted = 0;
  fPhotonsDetected = 0;
  fEventID = event->GetEventID();
}

void PanelEventAction::EndOfEventAction(const G4Event* /*event*/) {
  // Simple logging. In a real run you would also record primary vertex position.
  G4double x = 0, y = 0, z = 0; // would be filled from primary in better code

  gHitsFile << fEventID << "," << x << "," << y << "," << z << ","
            << fEdepScint / MeV << ","
            << fPhotonsProduced << ","
            << fPhotonsShifted << ","
            << fPhotonsDetected << "\n";

  if (fEventID % 100 == 0) {
    std::cout << "Event " << fEventID
              << "  Edep=" << fEdepScint/MeV << " MeV"
              << "  prod=" << fPhotonsProduced
              << "  shifted=" << fPhotonsShifted
              << "  detected=" << fPhotonsDetected << std::endl;
  }
}
