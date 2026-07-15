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
  // sPHENIX HCal photosensor: Hamamatsu S12572-33-015P (not MicroFC-30035).
  // Effective yield = scintYield × collectionEff × PDE when full optical
  // transport to the SiPM is incomplete (tessellated tile + segmented fiber).
  // Collection ~1.2% is an order-of-magnitude dual-end WLS + coupler factor;
  // PDE 0.25 matches the S12572-015P class used in sPHENIX HCal (Aidala et al.).
  eventAction->EnableEffectiveSipmYield(
      /*scintYieldPerMeV=*/10000.,
      /*collectionEff=*/0.012,
      /*pde=*/0.25,
      "Hamamatsu S12572-33-015P");
  SetUserAction(eventAction);
  SetUserAction(new PanelRunAction());
  SetUserAction(new PanelSteppingAction(eventAction));
}
