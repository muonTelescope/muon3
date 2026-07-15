#include "PanelEventAction.hh"

#include "G4Event.hh"
#include "G4EventManager.hh"
#include "G4SystemOfUnits.hh"
#include "Randomize.hh"
#include <fstream>
#include <iostream>
#include <cmath>

static std::ofstream gHitsFile("muon_panel_hits.csv");
static std::ofstream gPhotonFile("photon_stats.txt", std::ios::app);
static bool gHeaderWritten = false;

PanelEventAction::PanelEventAction() {
  if (!gHeaderWritten) {
    gHitsFile << "event,x_mm,y_mm,z_mm,edep_MeV,photons_prod,photons_shifted,photons_detected\n";
    gHeaderWritten = true;
  }
}

void PanelEventAction::EnableEffectiveSipmYield(G4double scintYieldPerMeV,
                                                G4double collectionEff,
                                                G4double pde,
                                                const G4String& sipmPart) {
  fUseEffectiveYield = true;
  fScintYieldPerMeV = scintYieldPerMeV;
  fCollectionEff = collectionEff;
  fPDE = pde;
  fSipmPart = sipmPart;
  std::cout << "PanelEventAction: effective SiPM yield enabled for " << fSipmPart
            << "  yield=" << fScintYieldPerMeV << " ph/MeV"
            << "  coll=" << fCollectionEff
            << "  PDE=" << fPDE
            << "  => " << (fScintYieldPerMeV * fCollectionEff * fPDE) << " p.e./MeV"
            << std::endl;
}

void PanelEventAction::BeginOfEventAction(const G4Event* event) {
  fEdepScint = 0.;
  fPhotonsProduced = 0;
  fPhotonsShifted = 0;
  fPhotonsDetected = 0;
  fEventID = event->GetEventID();
}

void PanelEventAction::EndOfEventAction(const G4Event* event) {
  G4double x = 0, y = 0, z = 0;
  if (event) {
    auto* prim = event->GetPrimaryVertex(0);
    if (prim) {
      x = prim->GetX0();
      y = prim->GetY0();
      z = prim->GetZ0();
    }
  }

  // Effective Hamamatsu (or other) SiPM yield when tracked optical photons
  // do not reach the photosensor volume (common with tessellated + segmented
  // fiber approximations). Poisson-sample around ⟨N_pe⟩.
  if (fUseEffectiveYield && fEdepScint > 0.) {
    const G4double meanPe =
        (fEdepScint / CLHEP::MeV) * fScintYieldPerMeV * fCollectionEff * fPDE;
    // Poisson via G4; fall back to rounded mean if mean is large
    G4int nPe = 0;
    if (meanPe > 0.) {
      nPe = static_cast<G4int>(CLHEP::RandPoisson::shoot(meanPe));
    }
    // Prefer tracked SiPM hits if any; otherwise use effective model
    if (fPhotonsDetected == 0) {
      fPhotonsDetected = nPe;
    }
  }

  gHitsFile << fEventID << "," << x << "," << y << "," << z << ","
            << fEdepScint / CLHEP::MeV << ","
            << fPhotonsProduced << ","
            << fPhotonsShifted << ","
            << fPhotonsDetected << "\n";

  if (fEventID % 100 == 0) {
    std::cout << "Event " << fEventID
              << "  Edep=" << fEdepScint / CLHEP::MeV << " MeV"
              << "  prod=" << fPhotonsProduced
              << "  shifted=" << fPhotonsShifted
              << "  detected=" << fPhotonsDetected;
    if (fUseEffectiveYield) {
      std::cout << "  [" << fSipmPart << " PDE=" << fPDE << "]";
    }
    std::cout << std::endl;
  }
}
