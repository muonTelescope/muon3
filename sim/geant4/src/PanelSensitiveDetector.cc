#include "PanelSensitiveDetector.hh"
#include "PanelEventAction.hh"

#include "G4Step.hh"
#include "G4Track.hh"
#include "G4OpticalPhoton.hh"
#include "G4SystemOfUnits.hh"
#include "G4EventManager.hh"
#include "G4UserEventAction.hh"
#include "Randomize.hh"

PanelSensitiveDetector::PanelSensitiveDetector(const G4String& name, PanelEventAction* evt,
                                               G4double pde)
  : G4VSensitiveDetector(name), fEventAction(evt), fPDE(pde) {}

void PanelSensitiveDetector::Initialize(G4HCofThisEvent*) {
  fPhotonCountThisEvent = 0;
}

G4bool PanelSensitiveDetector::ProcessHits(G4Step* step, G4TouchableHistory*) {
  auto* track = step->GetTrack();
  if (track->GetDefinition() != G4OpticalPhoton::OpticalPhotonDefinition()) return false;

  // Optical detection is only meaningful on SiPM volumes. Scintillator SDs must
  // NOT absorb/count optical photons here (edep is logged in SteppingAction).
  // Without this guard, photons are killed in the scintillator and never reach
  // the SiPM, and the default PDE would mask device-specific settings
  // (e.g. Hamamatsu S12572 vs MicroFC-30035).
  const G4String& sdName = GetName();
  if (sdName.find("SiPM") == std::string::npos &&
      sdName.find("sipm") == std::string::npos) {
    return false;
  }

  // Lookup EventAction if not set (for proper integration)
  if (!fEventAction) {
    G4UserEventAction* ua = G4EventManager::GetEventManager()->GetUserEventAction();
    fEventAction = dynamic_cast<PanelEventAction*>(ua);
  }

  // Apply device PDE (flat average at WLS green; wavelength dependence is future work).
  // Defaults / usage:
  //   - Muon3 loop panel: onsemi MicroFC-30035, PDE ~0.38 (C-series peak after WLS)
  //   - sPHENIX HCal tiles: Hamamatsu S12572-33-015P, PDE ~0.25 (Aidala et al. IEEE TNS 2018)
  // Approach modeled after phyxch/fiberPanel (optical-photon hit counter + statistical PDE).
  if (G4UniformRand() < fPDE) {
    fPhotonCountThisEvent++;
    if (fEventAction) fEventAction->AddPhotonDetected(1);
  }

  // Kill the photon at the SiPM so it doesn't scatter further
  track->SetTrackStatus(fStopAndKill);
  return true;
}

void PanelSensitiveDetector::EndOfEvent(G4HCofThisEvent*) {
  // Could fill more detailed collections here
}
