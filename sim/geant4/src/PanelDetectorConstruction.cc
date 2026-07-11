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
#include "G4LogicalVolumeStore.hh"
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

  // === Scintillator: EJ-200 equivalent ===
  // Literature: ~8000-10000 photons/MeV for MIPs (Eljen/Luxium datasheets, multiple muon telescope papers).
  // Composition from phyxch/fiberPanel + Eljen.
  G4double density = 1.023 * g/cm3;
  fScintMat = new G4Material("EJ200", density, 2);
  G4double fracH = 52.43 * perCent;
  G4double fracC = 47.57 * perCent;
  fScintMat->AddElement(nist->FindOrBuildElement("H"), fracH);
  fScintMat->AddElement(nist->FindOrBuildElement("C"), fracC);

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

  // Scintillator panel 200 x 200 x 10 mm (EJ-200)
  G4double hx = 100.*mm, hy=100.*mm, hz=5.*mm;
  auto* panelSolid = new G4Box("Panel", hx, hy, hz);
  auto* panelLV = new G4LogicalVolume(panelSolid, fScintMat, "PanelLV");
  auto* panelPV = new G4PVPlacement(nullptr, G4ThreeVector(0,0,0), panelLV, "Panel", worldLV, false, 0);

  // Realistic looped fiber geometry (rectangular loop + exit legs)
  // Based on historical scintillatorPanel CAD and phyxch/fiberPanel work.
  // Groove milled ~1.3mm wide (ball mill), fiber ~1mm dia multi-clad Kuraray Y-11 equiv.
  G4double fiberR = 0.5*mm;
  G4double grooveR = 0.65*mm;  // groove radius
  G4double legLen = 30.*mm;
  G4double zFiber = 3.2*mm;    // near top surface

  // Four corner tori (rounded corners of loop)
  G4double innerR = 70.*mm;    // approx to fit 200mm panel with margin
  auto* cornerTorus = new G4Torus("Corner", 0., fiberR, innerR, 0.*deg, 90.*deg);

  // Straight segments (four sides of loop)
  auto* straightX = new G4Tubs("StraightX", 0., fiberR, 140.*mm, 0., 360.*deg); // horizontal spans
  auto* straightY = new G4Tubs("StraightY", 0., fiberR, 140.*mm, 0., 360.*deg);

  // Combine into a single fiber core solid (union for simplicity; in practice use subtraction for groove)
  auto* coreSolid = new G4UnionSolid("FiberCore", 
    new G4UnionSolid("c1", cornerTorus, straightX, nullptr, G4ThreeVector(0, innerR, 0)),
    new G4UnionSolid("c2", straightY, cornerTorus, nullptr, G4ThreeVector(innerR, 0, 0))); // simplified union

  auto* fiberCoreLV = new G4LogicalVolume(new G4Tubs("FiberCoreFull", 0., fiberR, 80.*mm, 0., 360.*deg), fFiberCore, "FiberCoreLV"); // placeholder improved loop
  // For demo we keep a representative torus + legs; full polyline would use G4ExtrudedSolid or GDML in future.
  auto* mainLoop = new G4Torus("MainLoop", 0., fiberR, 82.*mm, 0., 360.*deg);
  auto* fiberCladLV = new G4LogicalVolume(new G4Torus("CladLoop", fiberR, fiberR+0.15*mm, 82.*mm, 0., 360.*deg), fFiberClad, "FiberCladLV");

  G4ThreeVector loopPos(0,0,zFiber);
  new G4PVPlacement(nullptr, loopPos, fiberCladLV, "FiberClad", panelLV, false, 0);
  new G4PVPlacement(nullptr, loopPos, new G4LogicalVolume(mainLoop, fFiberCore, "FiberCoreLV"), "FiberCore", panelLV, false, 0);

  // Exit legs (two straights to one edge, as in looped design)
  auto* legSolid = new G4Tubs("Leg", 0., fiberR, legLen/2, 0., 360.*deg);
  auto* legLV = new G4LogicalVolume(legSolid, fFiberCore, "ExitLegLV");
  new G4PVPlacement(nullptr, G4ThreeVector(95.*mm, -20.*mm, zFiber), legLV, "ExitLeg1", worldLV, false, 0);
  new G4PVPlacement(nullptr, G4ThreeVector(95.*mm, +20.*mm, zFiber), legLV, "ExitLeg2", worldLV, false, 0);

  // Optical cement layer (thin tube around fiber in groove) - simplified
  auto* cement = new G4Tubs("Cement", fiberR+0.01*mm, grooveR, 80.*mm, 0., 360.*deg);
  auto* cementLV = new G4LogicalVolume(cement, new G4Material("Cement", 1.13*g/cm3, 5), "CementLV"); // approx EJ-500
  new G4PVPlacement(nullptr, loopPos, cementLV, "Cement", panelLV, false, 0);

  // SiPM at end of one leg (3x3 mm)
  G4double s = 1.5*mm;
  auto* sipm = new G4Box("SiPM", s, s, 0.25*mm);
  auto* sipmLV = new G4LogicalVolume(sipm, fSi, "SiPMLV");
  new G4PVPlacement(nullptr, G4ThreeVector(95.*mm + legLen, -20.*mm, zFiber), sipmLV, "SiPM", worldLV, false, 0);

  // Visuals and reflector
  panelLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.2,0.8,0.3,0.5)));
  sipmLV->SetVisAttributes(new G4VisAttributes(G4Colour(1,0,0)));
  new G4LogicalSkinSurface("Refl", panelLV, fReflectorSurf);

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
