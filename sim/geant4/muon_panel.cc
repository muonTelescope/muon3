// muon_panel.cc
// Main for Muon3 panel + WLS fiber + SiPM Geant4 simulation.
// Simple, self-contained example using custom action classes.

#include "G4RunManagerFactory.hh"
#include "G4UImanager.hh"
#include "G4VisExecutive.hh"
#include "G4UIExecutive.hh"

#include "PanelDetectorConstruction.hh"
#include "PanelPhysicsList.hh"
#include "PanelPrimaryGeneratorAction.hh"
#include "PanelRunAction.hh"
#include "PanelEventAction.hh"
#include "PanelSteppingAction.hh"

int main(int argc, char** argv)
{
  auto* runManager = G4RunManagerFactory::CreateRunManager(G4RunManagerType::Default);

  // Detector
  runManager->SetUserInitialization(new PanelDetectorConstruction());

  // Physics (EM + Optical)
  runManager->SetUserInitialization(new PanelPhysicsList());

  // Actions
  runManager->SetUserAction(new PanelPrimaryGeneratorAction());
  runManager->SetUserAction(new PanelRunAction());
  auto* eventAction = new PanelEventAction();
  runManager->SetUserAction(eventAction);
  runManager->SetUserAction(new PanelSteppingAction(eventAction));

  // Visualization (optional)
  G4VisManager* visManager = nullptr;

  // UI
  G4UIExecutive* ui = nullptr;
  if (argc == 1) {
    ui = new G4UIExecutive(argc, argv);
  }

  G4UImanager* UImanager = G4UImanager::GetUIpointer();

  if (ui) {
    // Interactive
    visManager = new G4VisExecutive();
    visManager->Initialize();
    UImanager->ApplyCommand("/control/execute macros/vis.mac");
    ui->SessionStart();
    delete ui;
  } else {
    // Batch
    G4String command = "/control/execute ";
    G4String fileName = argv[1];
    UImanager->ApplyCommand(command + fileName);
  }

  delete visManager;
  delete runManager;
  return 0;
}
