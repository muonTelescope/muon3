#ifndef PANEL_SENSITIVE_DETECTOR_HH
#define PANEL_SENSITIVE_DETECTOR_HH

#include "G4VSensitiveDetector.hh"
#include "G4OpticalPhoton.hh"

class G4Step;
class G4HCofThisEvent;
class PanelEventAction;

class PanelSensitiveDetector : public G4VSensitiveDetector {
public:
  PanelSensitiveDetector(const G4String& name, PanelEventAction* evtAction,
                         G4double pde = 0.38);
  virtual ~PanelSensitiveDetector() = default;

  virtual void Initialize(G4HCofThisEvent* hce) override;
  virtual G4bool ProcessHits(G4Step* step, G4TouchableHistory* history) override;
  virtual void EndOfEvent(G4HCofThisEvent* hce) override;

  void SetPDE(G4double pde) { fPDE = pde; }
  G4double GetPDE() const { return fPDE; }

private:
  PanelEventAction* fEventAction;
  G4int fPhotonCountThisEvent = 0;
  /// Photon detection efficiency (device-averaged at WLS green).
  /// Muon3 MicroFC-30035 ~0.38; sPHENIX HCal Hamamatsu S12572-015P ~0.25.
  G4double fPDE = 0.38;
};

#endif
