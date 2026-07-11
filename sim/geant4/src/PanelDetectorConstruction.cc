// PanelDetectorConstruction.cc
// Geometry: 200x200x10 mm EJ-200 scintillator + looped WLS fiber + MicroFC-30035 readout.

#include "PanelDetectorConstruction.hh"
#include "PanelSensitiveDetector.hh"
#include "PanelEventAction.hh"

#include "G4NistManager.hh"
#include "G4Box.hh"
#include "G4Tubs.hh"
#include "G4Torus.hh"
#include "G4UnionSolid.hh"
#include "G4SubtractionSolid.hh"
#include "G4LogicalVolume.hh"
#include "G4PVPlacement.hh"
#include "G4SystemOfUnits.hh"
#include "G4VisAttributes.hh"
#include "G4Colour.hh"
#include "G4SDManager.hh"
#include "G4OpticalSurface.hh"
#include "G4LogicalBorderSurface.hh"
#include "G4LogicalSkinSurface.hh"
#include "G4MaterialPropertiesTable.hh"
#include "G4RunManager.hh"

PanelDetectorConstruction::PanelDetectorConstruction() {}
PanelDetectorConstruction::~PanelDetectorConstruction() {}

G4VPhysicalVolume* PanelDetectorConstruction::Construct() {
  DefineMaterials();
  return ConstructGeometry();
}

void PanelDetectorConstruction::DefineMaterials() {
  auto* nist = G4NistManager::Instance();
  fAir = nist->FindOrBuildMaterial("G4_AIR");
  fSi  = nist->FindOrBuildMaterial("G4_Si");

  // === Scintillator: EJ-200 equivalent (polystyrene base) ===
  G4double density = 1.032 * g/cm3;
  fScintMat = new G4Material("EJ200", density, 2);
  fScintMat->AddElement(nist->FindOrBuildElement("C"), 9);
  fScintMat->AddElement(nist->FindOrBuildElement("H"), 10);

  // Optical properties - scintillation + bulk
  auto* scintMPT = new G4MaterialPropertiesTable();

  // Scintillation spectrum (very approximate - peak ~425 nm)
  const G4int nBins = 6;
  G4double photonEnergy[nBins] = {2.5*eV, 2.7*eV, 2.9*eV, 3.0*eV, 3.1*eV, 3.3*eV};
  G4double scintComp[nBins]   = {0.1, 0.6, 1.0, 0.7, 0.3, 0.05};
  G4double rindex[nBins]      = {1.58, 1.58, 1.58, 1.58, 1.58, 1.58};
  G4double absLen[nBins]      = {200.*cm, 200.*cm, 200.*cm, 200.*cm, 200.*cm, 200.*cm}; // long in plastic

  scintMPT->AddProperty("FASTCOMPONENT", photonEnergy, scintComp, nBins);
  scintMPT->AddProperty("RINDEX", photonEnergy, rindex, nBins);
  scintMPT->AddProperty("ABSLENGTH", photonEnergy, absLen, nBins);
  scintMPT->AddConstProperty("SCINTILLATIONYIELD", fScintYield / MeV);
  scintMPT->AddConstProperty("RESOLUTIONSCALE", 1.0);
  scintMPT->AddConstProperty("FASTTIMECONSTANT", 2.1 * ns);
  scintMPT->AddConstProperty("YIELDRATIO", 1.0);

  fScintMat->SetMaterialPropertiesTable(scintMPT);

  // === WLS Fiber core (PMMA + shifter) ===
  fFiberCore = new G4Material("WLS_Core", 1.19 * g/cm3, 3);
  fFiberCore->AddElement(nist->FindOrBuildElement("C"), 5);
  fFiberCore->AddElement(nist->FindOrBuildElement("H"), 8);
  fFiberCore->AddElement(nist->FindOrBuildElement("O"), 2);

  auto* fiberMPT = new G4MaterialPropertiesTable();
  G4double fiberE[nBins]     = {2.0*eV, 2.3*eV, 2.6*eV, 2.9*eV, 3.1*eV, 3.4*eV}; // green emission dominant
  G4double fiberR[nBins]     = {1.49, 1.49, 1.49, 1.49, 1.49, 1.49};
  G4double fiberAbs[nBins]   = {3.5*cm, 3.5*cm, 0.5*cm, 0.02*cm, 0.01*cm, 0.01*cm}; // strong blue absorption
  G4double fiberWLS[nBins]   = {0.0, 0.1, 0.9, 1.0, 0.6, 0.1}; // emission spectrum (shifted)

  fiberMPT->AddProperty("RINDEX", fiberE, fiberR, nBins);
  fiberMPT->AddProperty("ABSLENGTH", fiberE, fiberAbs, nBins);
  fiberMPT->AddProperty("WLSABSLENGTH", fiberE, fiberAbs, nBins);
  fiberMPT->AddProperty("WLSCOMPONENT", fiberE, fiberWLS, nBins);
  fiberMPT->AddConstProperty("WLSTIMECONSTANT", 3.0*ns);
  fiberMPT->AddConstProperty("WLSMEANNUMBERPHOTONS", fWLSEff); // effective

  fFiberCore->SetMaterialPropertiesTable(fiberMPT);

  // Cladding (fluorinated polymer, lower n)
  fFiberClad = new G4Material("WLS_Clad", 1.40 * g/cm3, 2);
  fFiberClad->AddElement(nist->FindOrBuildElement("C"), 2);
  fFiberClad->AddElement(nist->FindOrBuildElement("F"), 4); // rough

  auto* cladMPT = new G4MaterialPropertiesTable();
  G4double cladR[nBins] = {1.42,1.42,1.42,1.42,1.42,1.42};
  G4double cladA[nBins] = {100.*cm,100.*cm,100.*cm,100.*cm,100.*cm,100.*cm};
  cladMPT->AddProperty("RINDEX", fiberE, cladR, nBins);
  cladMPT->AddProperty("ABSLENGTH", fiberE, cladA, nBins);
  fFiberClad->SetMaterialPropertiesTable(cladMPT);

  // Reflective wrapping surface (diffuse high reflectivity)
  fReflectorSurf = new G4OpticalSurface("Reflector", unified, ground, dielectric_metal);
  auto* refMPT = new G4MaterialPropertiesTable();
  G4double refE[2] = {2.0*eV, 3.5*eV};
  G4double refR[2] = {0.92, 0.92};
  refMPT->AddProperty("REFLECTIVITY", refE, refR, 2);
  fReflectorSurf->SetMaterialPropertiesTable(refMPT);
}

G4VPhysicalVolume* PanelDetectorConstruction::ConstructGeometry() {
  G4double worldSize = 1.0 * m;
  auto* worldBox = new G4Box("World", worldSize, worldSize, worldSize);
  auto* worldLV  = new G4LogicalVolume(worldBox, fAir, "WorldLV");
  auto* worldPV  = new G4PVPlacement(nullptr, G4ThreeVector(), worldLV, "World", nullptr, false, 0);

  // Scintillator panel 200 x 200 x 10 mm
  G4double hx = 100.*mm, hy=100.*mm, hz=5.*mm;
  auto* panelSolid = new G4Box("Panel", hx, hy, hz);
  auto* panelLV = new G4LogicalVolume(panelSolid, fScintMat, "PanelLV");

  // Place panel
  auto* panelPV = new G4PVPlacement(nullptr, G4ThreeVector(0,0,0), panelLV, "Panel", worldLV, false, 0);

  // Simple fiber loop approximation using torus + two straight segments
  // Groove path: rectangular loop with rounded corners. For starter we use a large torus + straights.
  G4double fiberRadius = 0.5*mm;
  G4double loopR = 85.*mm;   // rough loop radius inside 200mm panel

  // Torus for the rounded corners / main loop (simplified full torus for demo)
  auto* loopTorus = new G4Torus("FiberLoop", 0., fiberRadius, loopR, 0., 360.*deg);
  auto* fiberCoreLV = new G4LogicalVolume(loopTorus, fFiberCore, "FiberCoreLV");
  auto* fiberCladLV = new G4LogicalVolume(new G4Torus("FiberClad", fiberRadius, fiberRadius+0.15*mm, loopR, 0., 360.*deg),
                                          fFiberClad, "FiberCladLV");

  // Place fiber (slightly offset in Z to sit near top surface)
  G4ThreeVector fiberPos(0, 0, 3.5*mm);
  new G4PVPlacement(nullptr, fiberPos, fiberCladLV, "FiberClad", panelLV, false, 0);
  new G4PVPlacement(nullptr, fiberPos, fiberCoreLV, "FiberCore", panelLV, false, 0);

  // One fiber "exit leg" towards +X (simplified straight tube representing the exit to connector)
  auto* exitLeg = new G4Tubs("ExitLeg", 0., fiberRadius, 25.*mm, 0., 360.*deg);
  auto* exitLV  = new G4LogicalVolume(exitLeg, fFiberCore, "ExitFiberLV");
  auto* exitPV  = new G4PVPlacement(nullptr, G4ThreeVector(100.*mm + 20.*mm, 0, 3.5*mm), exitLV, "ExitFiber", worldLV, false, 0);

  // SiPM volume at end of exit fiber (3x3 mm active area, thin)
  G4double sipmHalf = 1.5*mm;
  auto* sipmSolid = new G4Box("SiPM", sipmHalf, sipmHalf, 0.2*mm);
  auto* sipmLV = new G4LogicalVolume(sipmSolid, fSi, "SiPMLV");
  new G4PVPlacement(nullptr, G4ThreeVector(130.*mm, 0, 3.5*mm), sipmLV, "SiPM", worldLV, false, 0);

  // Visual attributes
  panelLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.2, 0.8, 0.3, 0.6)));
  fiberCoreLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.1, 0.9, 0.4)));
  sipmLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.8, 0.1, 0.1)));

  // Skin surface for reflector on panel
  new G4LogicalSkinSurface("PanelReflector", panelLV, fReflectorSurf);

  fScintMat->SetMaterialPropertiesTable(fScintMat->GetMaterialPropertiesTable()); // ensure

  return worldPV;
}

void PanelDetectorConstruction::ConstructSDandField() {
  auto* sdManager = G4SDManager::GetSDMpointer();

  // Sensitive detector on the SiPM volume (optical photon counting)
  auto* sipmSD = new PanelSensitiveDetector("SiPM_SD", nullptr); // event action wired later if needed
  sdManager->AddNewDetector(sipmSD);

  // Attach to logical volume named "SiPMLV"
  if (auto* lv = G4LogicalVolumeStore::GetInstance()->GetVolume("SiPMLV", false)) {
    lv->SetSensitiveDetector(sipmSD);
  }

  // Also make the scintillator sensitive for energy deposit logging
  auto* scintSD = new PanelSensitiveDetector("Scint_SD", nullptr);
  sdManager->AddNewDetector(scintSD);
  if (auto* plv = G4LogicalVolumeStore::GetInstance()->GetVolume("PanelLV", false)) {
    plv->SetSensitiveDetector(scintSD);
  }
}
