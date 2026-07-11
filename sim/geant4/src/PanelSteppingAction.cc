#include "PanelSteppingAction.hh"
#include "PanelEventAction.hh"

#include "G4Step.hh"
#include "G4Track.hh"
#include "G4ParticleDefinition.hh"
#include "G4OpticalPhoton.hh"

PanelSteppingAction::PanelSteppingAction(PanelEventAction* ea) : fEventAction(ea) {}

void PanelSteppingAction::UserSteppingAction(const G4Step* step) {
  auto* track = step->GetTrack();
  auto* particle = track->GetDefinition();

  // Scintillator energy deposit
  if (step->GetPreStepPoint()->GetTouchableHandle()->GetVolume()->GetName().find("Panel") != std::string::npos) {
    G4double edep = step->GetTotalEnergyDeposit();
    if (edep > 0 && fEventAction) fEventAction->AddScintEnergy(edep);
  }

  // Count optical photons
  if (particle == G4OpticalPhoton::OpticalPhotonDefinition()) {
    // Very rough classification by creator process name
    G4String creator = track->GetCreatorProcess() ? track->GetCreatorProcess()->GetProcessName() : "";
    if (creator == "Scintillation" && fEventAction) {
      fEventAction->AddPhotonProduced(1);
    } else if (creator.find("WLS") != std::string::npos && fEventAction) {
      fEventAction->AddPhotonShifted(1);
    }
  }
}
