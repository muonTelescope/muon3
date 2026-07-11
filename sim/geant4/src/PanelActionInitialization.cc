#include "PanelActionInitialization.hh"

#include "PanelPrimaryGeneratorAction.hh"
#include "PanelRunAction.hh"
#include "PanelEventAction.hh"
#include "PanelSteppingAction.hh"

void PanelActionInitialization::BuildForMaster() const
{
  // Master thread only needs RunAction for merging
  SetUserAction(new PanelRunAction());
}

void PanelActionInitialization::Build() const
{
  // Worker threads get full set of actions
  SetUserAction(new PanelPrimaryGeneratorAction());

  auto* runAction = new PanelRunAction();
  SetUserAction(runAction);

  auto* eventAction = new PanelEventAction();
  SetUserAction(eventAction);

  SetUserAction(new PanelSteppingAction(eventAction));
}
