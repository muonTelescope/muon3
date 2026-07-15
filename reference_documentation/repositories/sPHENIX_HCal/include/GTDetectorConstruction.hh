// Feb 8, 2021: Hexc and Zachary
// A simple and quick geometry test project using GEANT4
//

#ifndef GTDetectorConstruction_h
#define GTDetectorConstruction_h 1

#include "G4VUserDetectorConstruction.hh"
#include "globals.hh"

class G4VPhysicalVolume;
class G4LogicalVolume;

/// Detector construction class to define materials and geometry.

class GTDetectorConstruction : public G4VUserDetectorConstruction
{
  public:
    GTDetectorConstruction();
    virtual ~GTDetectorConstruction();

    virtual G4VPhysicalVolume* Construct();
    
    G4LogicalVolume* GetScoringVolume() const { return fScoringVolume; }

  protected:
    G4LogicalVolume*  fScoringVolume;
};

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

#endif

