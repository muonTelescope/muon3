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

  // Simple PDE application here (could be more sophisticated with wavelength)
  G4double pde = 0.40; // default; better to read from construction
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
