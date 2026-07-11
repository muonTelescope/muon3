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

  // Scintillator energy deposit - record edep and estimate produced photons
  // (using the material's SCINTILLATIONYIELD of 10000 ph/MeV)
  G4String volName = step->GetPreStepPoint()->GetTouchableHandle()->GetVolume()->GetName();
  if (volName.find("Panel") != std::string::npos) {
    G4double edep = step->GetTotalEnergyDeposit();
    if (edep > 0 && fEventAction) {
      fEventAction->AddScintEnergy(edep);
      // Estimate scintillation photons produced (total will be correct across steps)
      G4double yield = 10000.0 / CLHEP::MeV;
      fEventAction->AddPhotonProduced( static_cast<G4int>(edep * yield + 0.5) );
    }
  }

  // Count optical photons (for WLS shifting)
  if (particle == G4OpticalPhoton::OpticalPhotonDefinition()) {
    G4String creator = track->GetCreatorProcess() ? track->GetCreatorProcess()->GetProcessName() : "";
    if (creator.find("WLS") != std::string::npos || creator.find("OpWLS") != std::string::npos) {
      if (fEventAction) fEventAction->AddPhotonShifted(1);
    }
  }
}
