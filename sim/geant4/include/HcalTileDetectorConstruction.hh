#ifndef HCAL_TILE_DETECTOR_CONSTRUCTION_HH
#define HCAL_TILE_DETECTOR_CONSTRUCTION_HH

#include "G4VUserDetectorConstruction.hh"
#include "G4String.hh"
#include "globals.hh"

class G4VPhysicalVolume;
class G4OpticalSurface;

/// Load an sPHENIX Inner HCal tile assembly GDML (tessellated scintillator +
/// WLS fiber + diffuse coating + light-tight wrap + light blocker + SiPM)
/// and attach optical material properties for photon transport studies.
class HcalTileDetectorConstruction : public G4VUserDetectorConstruction {
public:
  explicit HcalTileDetectorConstruction(const G4String& gdmlPath);
  virtual ~HcalTileDetectorConstruction();

  virtual G4VPhysicalVolume* Construct() override;
  virtual void ConstructSDandField() override;

  void SetPDE(G4double pde) { fPDE = pde; }
  G4double GetPDE() const { return fPDE; }

private:
  void AttachOpticalProperties();
  void SetupSurfaces(G4VPhysicalVolume* world);

  G4String fGdmlPath;
  G4double fScintYield = 10000.;  // ph/MeV (EJ-200 class)
  G4double fWLSEff = 0.90;
  G4double fPDE = 0.40;
  G4OpticalSurface* fReflectorSurf = nullptr;
};

#endif
