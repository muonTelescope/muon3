#ifndef PANEL_SENSITIVE_DETECTOR_HH
#define PANEL_SENSITIVE_DETECTOR_HH

#include "G4VSensitiveDetector.hh"
#include "G4OpticalPhoton.hh"

class G4Step;
class G4HCofThisEvent;
class PanelEventAction;

class PanelSensitiveDetector : public G4VSensitiveDetector {
public:
  PanelSensitiveDetector(const G4String& name, PanelEventAction* evtAction);
  virtual ~PanelSensitiveDetector() = default;

  virtual void Initialize(G4HCofThisEvent* hce) override;
  virtual G4bool ProcessHits(G4Step* step, G4TouchableHistory* history) override;
  virtual void EndOfEvent(G4HCofThisEvent* hce) override;

private:
  PanelEventAction* fEventAction;
  G4int fPhotonCountThisEvent = 0;
};

#endif
