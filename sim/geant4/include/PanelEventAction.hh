#ifndef PANEL_EVENT_ACTION_HH
#define PANEL_EVENT_ACTION_HH

#include "G4UserEventAction.hh"
#include "globals.hh"

class PanelEventAction : public G4UserEventAction {
public:
  PanelEventAction();
  virtual ~PanelEventAction() = default;

  virtual void BeginOfEventAction(const G4Event* event) override;
  virtual void EndOfEventAction(const G4Event* event) override;

  // Accumulators called from SD / stepping
  void AddScintEnergy(G4double de) { fEdepScint += de; }
  void AddPhotonProduced(G4int n)  { fPhotonsProduced += n; }
  void AddPhotonShifted(G4int n)   { fPhotonsShifted += n; }
  void AddPhotonDetected(G4int n)  { fPhotonsDetected += n; }

private:
  G4double fEdepScint = 0.;
  G4int    fPhotonsProduced = 0;
  G4int    fPhotonsShifted  = 0;
  G4int    fPhotonsDetected = 0;
  G4int    fEventID = 0;
};

#endif
