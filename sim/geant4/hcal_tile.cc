// hcal_tile.cc
// Geant4 application for sPHENIX Inner HCal tile assemblies
// (tessellated EJ-200 + WLS fiber + coating + wrap + light blocker + SiPM).

#include "G4RunManagerFactory.hh"
#include "G4UImanager.hh"
#include "G4VisExecutive.hh"
#include "G4UIExecutive.hh"
#include "G4SystemOfUnits.hh"

#include "HcalTileDetectorConstruction.hh"
#include "HcalTileActionInitialization.hh"
#include "PanelPhysicsList.hh"

#include <cstdlib>
#include <string>

static void PrintUsage() {
  G4cout << "Usage: hcal_tile [-g gdml_file] [--tile-center x y z hx hy] [macro]\n"
         << "  -g gdml   Path to assembly GDML (default: gdml/InnerHCalTile01_EJ200_assembly.gdml)\n"
         << "  --tile-center x y z hx hy   Tile center (mm) and half-extents for the gun\n"
         << "  macro     Optional batch macro; omit for interactive vis session\n";
}

int main(int argc, char** argv) {
  G4String gdml = "gdml/InnerHCalTile01_EJ200_assembly.gdml";
  G4String macro;
  // Defaults for InnerHCalTile01 (~120 x 191 x 7 mm starting at origin)
  G4double x0 = 60. * mm, y0 = 95. * mm, z0 = 0.;
  G4double hx = 55. * mm, hy = 90. * mm;

  for (int i = 1; i < argc; ++i) {
    std::string a = argv[i];
    if (a == "-h" || a == "--help") {
      PrintUsage();
      return 0;
    }
    if (a == "-g" && i + 1 < argc) {
      gdml = argv[++i];
      continue;
    }
    if (a == "--tile-center" && i + 5 < argc) {
      x0 = std::atof(argv[++i]) * mm;
      y0 = std::atof(argv[++i]) * mm;
      z0 = std::atof(argv[++i]) * mm;
      hx = std::atof(argv[++i]) * mm;
      hy = std::atof(argv[++i]) * mm;
      continue;
    }
    if (a[0] != '-') {
      macro = a;
      continue;
    }
    G4cerr << "Unknown arg: " << a << G4endl;
    PrintUsage();
    return 1;
  }

  auto* runManager = G4RunManagerFactory::CreateRunManager(G4RunManagerType::Serial);

  runManager->SetUserInitialization(new HcalTileDetectorConstruction(gdml));
  runManager->SetUserInitialization(new PanelPhysicsList());
  runManager->SetUserInitialization(
      new HcalTileActionInitialization(x0, y0, z0, hx, hy));

  G4VisManager* visManager = nullptr;
  G4UIExecutive* ui = nullptr;
  if (macro.empty()) {
    ui = new G4UIExecutive(argc, argv);
  }

  G4UImanager* UImanager = G4UImanager::GetUIpointer();

  if (ui) {
    visManager = new G4VisExecutive();
    visManager->Initialize();
    UImanager->ApplyCommand("/control/execute macros/hcal_tile_vis.mac");
    ui->SessionStart();
    delete ui;
  } else {
    UImanager->ApplyCommand("/control/execute " + macro);
  }

  delete visManager;
  delete runManager;
  return 0;
}
