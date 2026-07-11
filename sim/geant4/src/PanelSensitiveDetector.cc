#include "PanelSensitiveDetector.hh"
#include "PanelEventAction.hh"

#include "G4Step.hh"
#include "G4Track.hh"
#include "G4OpticalPhoton.hh"
#include "G4SystemOfUnits.hh"
#include "G4EventManager.hh"
#include "G4UserEventAction.hh"
#include "Randomize.hh"

PanelSensitiveDetector::PanelSensitiveDetector(const G4String& name, PanelEventAction* evt)
  : G4VSensitiveDetector(name), fEventAction(evt) {}

void PanelSensitiveDetector::Initialize(G4HCofThisEvent*) {
  fPhotonCountThisEvent = 0;
}

G4bool PanelSensitiveDetector::ProcessHits(G4Step* step, G4TouchableHistory*) {
  auto* track = step->GetTrack();
  if (track->GetDefinition() != G4OpticalPhoton::OpticalPhotonDefinition()) return false;

  // Lookup EventAction if not set (for proper integration)
  if (!fEventAction) {
    G4UserEventAction* ua = G4EventManager::GetEventManager()->GetUserEventAction();
    fEventAction = dynamic_cast<PanelEventAction*>(ua);
  }

  // PDE application (wavelength dependent in full model; here average for shifted ~510nm light).
  // Literature: MicroFC-30035 PDE ~35-45% at peak after WLS (onsemi C-series datasheet + typical muon panel papers).
  // Approach modeled after phyxch/fiberPanel (ref: reference_documentation/repositories/fiberPanel).
  G4double pde = 0.38; // updated from literature cross-check
  if (G4UniformRand() < pde) {
    fPhotonCountThisEvent++;
    if (fEventAction) fEventAction->AddPhotonDetected(1);
  }

  // Kill the photon so it doesn't propagate further
  track->SetTrackStatus(fStopAndKill);
  return true;
}

void PanelSensitiveDetector::EndOfEvent(G4HCofThisEvent*) {
  // Could fill more detailed collections here
}
