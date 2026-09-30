#include "PanelSteppingAction.hh"
#include "PanelEventAction.hh"

#include "G4Step.hh"
#include "G4Track.hh"
#include "G4ParticleDefinition.hh"
#include "G4OpticalPhoton.hh"
#include "G4VProcess.hh"
#include "G4VPhysicalVolume.hh"
#include "G4Event.hh"
#include "G4RunManager.hh"
#include <cstdlib>
#include <fstream>

namespace {
/// Optical-photon debug log (HCAL_DEBUG=1): where and how every photon of the first HCAL_DEBUG_EVENTS events ends
/// (photon_fate.csv), plus every step of the first 300 photons of event 0 (photon_tracks.csv).
struct PhotonDebug {
  bool on = std::getenv("HCAL_DEBUG") != nullptr;
  int maxEvents = std::getenv("HCAL_DEBUG_EVENTS") ? std::atoi(std::getenv("HCAL_DEBUG_EVENTS")) : 5;
  std::ofstream fate, trk;
  PhotonDebug() {
    if (!on) return;
    fate.open("photon_fate.csv"); fate << "event,track,creator,x,y,z,pre,post,proc,E_eV\n";
    trk.open("photon_tracks.csv"); trk << "track,creator,step,x,y,z,vol\n";
  }
};
PhotonDebug gDbg;
}  // namespace

PanelSteppingAction::PanelSteppingAction(PanelEventAction* ea) : fEventAction(ea) {}

void PanelSteppingAction::UserSteppingAction(const G4Step* step) {
  auto* track = step->GetTrack();
  auto* particle = track->GetDefinition();

  // Scintillator energy deposit - record edep and estimate produced photons
  // (using the material's SCINTILLATIONYIELD of 10000 ph/MeV)
  G4String volName = step->GetPreStepPoint()->GetTouchableHandle()->GetVolume()->GetName();
  // Muon3 panel volumes ("Panel*") and sPHENIX Inner HCal tessellated tiles
  if (volName.find("Panel") != std::string::npos ||
      volName.find("InnerHCal") != std::string::npos ||
      volName.find("EJ200") != std::string::npos || volName.find("PS_PTP") != std::string::npos) {
    G4double edep = step->GetTotalEnergyDeposit();
    if (edep > 0 && fEventAction) {
      fEventAction->AddScintEnergy(edep);
      // Estimate scintillation photons produced (total will be correct across steps)
      G4double yield = 10000.0 / CLHEP::MeV;
      fEventAction->AddPhotonProduced( static_cast<G4int>(edep * yield + 0.5) );
    }
  }

  if (gDbg.on && particle == G4OpticalPhoton::OpticalPhotonDefinition()) {
    const int evt = G4RunManager::GetRunManager()->GetCurrentEvent()->GetEventID();
    if (evt < gDbg.maxEvents) {
      auto* post = step->GetPostStepPoint(); auto* pre = step->GetPreStepPoint();
      const auto pos = post->GetPosition();
      const G4String creator = track->GetCreatorProcess() ? track->GetCreatorProcess()->GetProcessName() : "primary";
      const G4String preV = pre->GetPhysicalVolume() ? pre->GetPhysicalVolume()->GetName() : "none";
      const G4String postV = post->GetPhysicalVolume() ? post->GetPhysicalVolume()->GetName() : "OutOfWorld";
      if (evt == 0 && (creator == "OpWLS" ? (track->GetTrackID() % 12) == 0 : track->GetTrackID() < 60000 && (track->GetTrackID() % 200) == 0))
        gDbg.trk << track->GetTrackID() << "," << creator << "," << track->GetCurrentStepNumber() << "," << pos.x() / CLHEP::mm << ","
                 << pos.y() / CLHEP::mm << "," << pos.z() / CLHEP::mm << "," << preV << "\n";
      if (track->GetTrackStatus() == fStopAndKill || !post->GetPhysicalVolume()) {
        const auto* pd = post->GetProcessDefinedStep();
        gDbg.fate << evt << "," << track->GetTrackID() << "," << creator << "," << pos.x() / CLHEP::mm << "," << pos.y() / CLHEP::mm << ","
                  << pos.z() / CLHEP::mm << "," << preV << "," << postV << "," << (pd ? pd->GetProcessName() : "none") << ","
                  << track->GetKineticEnergy() / CLHEP::eV << "\n";
      }
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
