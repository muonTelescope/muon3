#include "PanelPhysicsList.hh"

#include "G4EmStandardPhysics.hh"
#include "G4OpticalPhysics.hh"
#include "G4DecayPhysics.hh"
#include "G4SystemOfUnits.hh"

PanelPhysicsList::PanelPhysicsList() : G4VModularPhysicsList() {
  SetVerboseLevel(1);
  SetDefaultCutValue(0.1 * mm);

  RegisterPhysics(new G4EmStandardPhysics());
  RegisterPhysics(new G4DecayPhysics());

  // Optical physics is essential
  auto* optical = new G4OpticalPhysics();
  optical->SetVerboseLevel(1);
  RegisterPhysics(optical);
}

void PanelPhysicsList::SetCuts() {
  SetCutValue(0.1 * mm, "gamma");
  SetCutValue(0.05 * mm, "e-");
  SetCutValue(0.05 * mm, "e+");
}
