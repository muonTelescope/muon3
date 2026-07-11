#include "PanelSteppingAction.hh"
#include "PanelEventAction.hh"

#include "G4Step.hh"
#include "G4Track.hh"
#include "G4ParticleDefinition.hh"
#include "G4OpticalPhoton.hh"
#include "G4VProcess.hh"

PanelSteppingAction::PanelSteppingAction(PanelEventAction* ea) : fEventAction(ea) {}

void PanelSteppingAction::UserSteppingAction(const G4Step* step) {
  auto* track = step->GetTrack();
  auto* particle = track->GetDefinition();

  // Scintillator energy deposit
  G4String volName = step->GetPreStepPoint()->GetTouchableHandle()->GetVolume()->GetName();
  if (volName.find("Panel") != std::string::npos) {
    G4double edep = step->GetTotalEnergyDeposit();
    if (edep > 0 && fEventAction) fEventAction->AddScintEnergy(edep);
  }

  // Count optical photons reaching SD or WLS
  if (particle == G4OpticalPhoton::OpticalPhotonDefinition()) {
    G4String creator = track->GetCreatorProcess() ? track->GetCreatorProcess()->GetProcessName() : "";
    if (creator == "Scintillation" && fEventAction) {
      // already estimated above; could increment here too but avoid double
    } else if (creator.find("WLS") != std::string::npos && fEventAction) {
      fEventAction->AddPhotonShifted(1);
    }
  }
}
