#ifndef PANEL_STEPPING_ACTION_HH
#define PANEL_STEPPING_ACTION_HH

#include "G4UserSteppingAction.hh"

class PanelEventAction;

class PanelSteppingAction : public G4UserSteppingAction {
public:
  PanelSteppingAction(PanelEventAction* eventAction);
  virtual ~PanelSteppingAction() = default;
  virtual void UserSteppingAction(const G4Step* step) override;

private:
  PanelEventAction* fEventAction = nullptr;
};

#endif
