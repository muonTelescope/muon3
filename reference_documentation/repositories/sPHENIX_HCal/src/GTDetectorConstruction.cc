// Feb 8, 2021: Hexc and Zachary
// A simple and quick geometry test project using GEANT4
//
// Mar 29, 2021: Hexc and Zachary
// Test a triangle volume using a gdml file generated from ROOT.
//
// Dec 9, 2021: Hexc
// Test the mRICH support structure modeled by Alex Eslinger
//
// Dec 17, 2021: hexc
// Test sPHENIX HCal tiles and absorber geometries.
//
// Jan 11, 2022: hexc
// Start testing inner hcal geometry
// Feb, 2022: hexc
// Got updated stl files from Rich for Inner HCal tiles.


#include "GTDetectorConstruction.hh"

#include "G4RunManager.hh"
#include "G4NistManager.hh"
#include "G4Box.hh"
#include "G4Cons.hh"
#include "G4Orb.hh"
#include "G4Sphere.hh"
#include "G4Trd.hh"
#include "G4Trap.hh"
#include "G4LogicalVolume.hh"
#include "G4PVPlacement.hh"
#include "G4SystemOfUnits.hh"

#include "G4GDMLParser.hh"

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

GTDetectorConstruction::GTDetectorConstruction()
: G4VUserDetectorConstruction(),
  fScoringVolume(0)
{ }

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

GTDetectorConstruction::~GTDetectorConstruction()
{ }

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

G4VPhysicalVolume* GTDetectorConstruction::Construct()
{  
  // Get nist material manager
  G4NistManager* nist = G4NistManager::Instance();
  
  // Envelope parameters
  //
  G4double env_sizeXY = 40*cm, env_sizeZ = 30*cm;
  G4Material* env_mat = nist->FindOrBuildMaterial("G4_WATER");
   
  // Option to switch on/off checking of volumes overlaps
  //
  G4bool checkOverlaps = true;
      
  // Read in gdml detector description
  G4GDMLParser parser;


  // parser.Read("oneSectorOuterHCal.gdml");
  parser.Read("sPHENIX_HCal.gdml");
  //  parser.Read("Inner12.gdml");  
  //  parser.Read("InnerHCalFull.gdml");  // OK,
  //  parser.Read("OuterHCalFull.gdml");  // OK,
  //  parser.Read("InnerOuterHCalAbsorberSector.gdml");  // OK
  //  parser.Read("InnerHCalAbsorberSector.gdml");  // OK  
  //  parser.Read("InnerHCalSectorNoEndPlate.gdml"); // OK
  //  parser.Read("InnerHCALNoEndplates.gdml"); // Not ok. the gdml file seems too large
  //  parser.Read("InnerTilesAssembly.gdml"); // OK
  //  parser.Read("InnerHCalAbsorberTiles.gdml");  // OK completed on 3/3/22 
  //  parser.Read("InnerTiles360Assembly.gdml");  // OK
  //  parser.Read("InnerTiles360AssemblyTagging.gdml");  // OK  
  //  parser.Read("InnerTiles.gdml"); // OK
  //  parser.Read("InnerTile24Assembly.gdml"); // OK
  //  parser.Read("InnerHCalSector.gdml"); // OK
  
  //  parser.Read("OuterHCalFibers.gdml"); // OK
  //  parser.Read("OuterHCalChimneyFibers.gdml"); // OK
  //  parser.Read("OuterHCalChimneyTiles.gdml"); // OK
  //  parser.Read("OuterHCalChimney.gdml"); // OK
  //  parser.Read("OuterHCalAbsorber.gdml");  // OK
  //  parser.Read("OuterHCalAbsorberTiles.gdml");  // OK, only half sector tiles are included.
  //G4cout << "Geometry loaded from  file ...... OuterHCalAbsorberTiles.gdml" << G4endl;  
  //  parser.Read("OuterHCalAbsorber360.gdml");  // runs but placement is wrong
  //  parser.Read("OuterHCalAbsorber360Rotate.gdml");  // OK
  //  parser.Read("OuterHCalAbsorber360wChimney.gdml");  // OK
  //  parser.Read("OuterHCalAbsorberSector.gdml");  // OK all absorber sectors with chimney sectors as well
  //  parser.Read("OuterHCalAbsorber360_new.gdml");  // OK
  //  parser.Read("OuterHCalAbsorberArray.gdml");  // OK
  //  parser.Read("OuterHCal360.gdml");  // Not OK
  //  parser.Read("outerTiles.gdml");  // OK
  //  parser.Read("outerTilesAssembly.gdml");  // OK
  //  parser.Read("OuterTiles360Assembly.gdml");  // OK
  //  parser.Read("outerTilesChimneyAssembly.gdml");  // OK
  //  parser.Read("OuterHCalTilesNoGroove.gdml");  // OK
  //  parser.Read("OuterHCalTilesGroove.gdml");   // OK
  //  parser.Read("OuterHCalSectorWithTilesAndInnerSkins.gdml");  // OK
  //  parser.Read("innerOneSector.gdml"); // no OK
  //parser.Read("outerOneSector.gdml");    // OK
  //parser.Read("OuterHCalNoTilesTest.gdml");    // OK
  
  //  parser.Read("mRICH_support.gdml");
  //  parser.Read("FrontFoamWall.gdml");
  //  parser.Read("BackFoamWall.gdml");
  //  parser.Read("loopPanel_only.gdml");
  //  parser.Read("fiberLoop_only.gdml");
  //  parser.Read("triangle.gdml");
  
  G4VPhysicalVolume* physWorld = parser.GetWorldVolume();
  G4LogicalVolume* logicWorld = physWorld->GetLogicalVolume();

  //
  //always return the physical World
  //
  return physWorld;
}

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......
