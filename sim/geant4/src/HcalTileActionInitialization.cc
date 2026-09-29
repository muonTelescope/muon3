#include "HcalTileActionInitialization.hh"
#include "HcalTilePrimaryGeneratorAction.hh"
#include "PanelRunAction.hh"
#include "PanelEventAction.hh"
#include "PanelSteppingAction.hh"

#include <cstdlib>

HcalTileActionInitialization::HcalTileActionInitialization(
    G4double x0, G4double y0, G4double z0, G4double halfX, G4double halfY)
  : fX0(x0), fY0(y0), fZ0(z0), fHalfX(halfX), fHalfY(halfY) {}

void HcalTileActionInitialization::BuildForMaster() const {
  SetUserAction(new PanelRunAction());
}

void HcalTileActionInitialization::Build() const {
  SetUserAction(new HcalTilePrimaryGeneratorAction(fX0, fY0, fZ0, fHalfX, fHalfY));
  auto* eventAction = new PanelEventAction();
  // Photo-electrons come from tracked optical photons reaching the S12572 only. The old default substituted
  // E_dep × 10000/MeV × 1.2 % × 0.25 whenever none arrived — that formula, not transport, was the published
  // "58 p.e./muon". Opt back in with HCAL_EFFECTIVE_YIELD=1 for quick non-optical runs.
  if (std::getenv("HCAL_EFFECTIVE_YIELD"))
    eventAction->EnableEffectiveSipmYield(/*scintYieldPerMeV=*/8000., /*collectionEff=*/0.012, /*pde=*/0.25,
                                          "Hamamatsu S12572-33-015P");
  SetUserAction(eventAction);
  SetUserAction(new PanelRunAction());
  SetUserAction(new PanelSteppingAction(eventAction));
}
