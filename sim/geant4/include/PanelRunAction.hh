#ifndef PANEL_RUN_ACTION_HH
#define PANEL_RUN_ACTION_HH

#include "G4UserRunAction.hh"

class G4Run;

class PanelRunAction : public G4UserRunAction {
public:
  PanelRunAction();
  virtual ~PanelRunAction() = default;

  virtual void BeginOfRunAction(const G4Run* run) override;
  virtual void EndOfRunAction(const G4Run* run) override;
};

#endif
