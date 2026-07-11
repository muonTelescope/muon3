#ifndef PANEL_DETECTOR_CONSTRUCTION_HH
#define PANEL_DETECTOR_CONSTRUCTION_HH

#include "G4VUserDetectorConstruction.hh"
#include "G4Material.hh"
#include "G4LogicalVolume.hh"
#include "G4OpticalSurface.hh"

class G4VPhysicalVolume;

class PanelDetectorConstruction : public G4VUserDetectorConstruction {
public:
  PanelDetectorConstruction();
  virtual ~PanelDetectorConstruction();

  virtual G4VPhysicalVolume* Construct() override;
  virtual void ConstructSDandField() override;

  // Tunable parameters (set via UI or constructor)
  void SetScintYield(G4double ph_per_MeV) { fScintYield = ph_per_MeV; }
  void SetFiberWLS_Eff(G4double eff) { fWLSEff = eff; }
  void SetPDE(G4double pde) { fPDE = pde; }

private:
  void DefineMaterials();
  G4VPhysicalVolume* ConstructGeometry();

  G4Material* fScintMat = nullptr;
  G4Material* fFiberCore = nullptr;
  G4Material* fFiberClad = nullptr;
  G4Material* fAir = nullptr;
  G4Material* fSi = nullptr;

  G4double fScintYield = 10000.;   // ph/MeV
  G4double fWLSEff     = 0.90;     // improved WLS quantum eff. for better yield match to lit. ~50+ p.e./MeV
  G4double fPDE        = 0.40;     // SiPM photon detection efficiency at fiber emission

  G4OpticalSurface* fReflectorSurf = nullptr;
  G4OpticalSurface* fCementSurf = nullptr;
};

#endif
