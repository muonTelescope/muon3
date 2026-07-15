#include "HcalTileActionInitialization.hh"
#include "HcalTilePrimaryGeneratorAction.hh"
#include "PanelRunAction.hh"
#include "PanelEventAction.hh"
#include "PanelSteppingAction.hh"

HcalTileActionInitialization::HcalTileActionInitialization(
    G4double x0, G4double y0, G4double z0, G4double halfX, G4double halfY)
  : fX0(x0), fY0(y0), fZ0(z0), fHalfX(halfX), fHalfY(halfY) {}

void HcalTileActionInitialization::BuildForMaster() const {
  SetUserAction(new PanelRunAction());
}

void HcalTileActionInitialization::Build() const {
  SetUserAction(new HcalTilePrimaryGeneratorAction(fX0, fY0, fZ0, fHalfX, fHalfY));
  auto* eventAction = new PanelEventAction();
  SetUserAction(eventAction);
  SetUserAction(new PanelRunAction());
  SetUserAction(new PanelSteppingAction(eventAction));
}
