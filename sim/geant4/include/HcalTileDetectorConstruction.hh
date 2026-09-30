#ifndef HCAL_TILE_DETECTOR_CONSTRUCTION_HH
#define HCAL_TILE_DETECTOR_CONSTRUCTION_HH

#include "G4VUserDetectorConstruction.hh"
#include "G4String.hh"
#include "globals.hh"

class G4VPhysicalVolume;
class G4OpticalSurface;

/// sPHENIX Inner HCal tile assembly (Aidala et al., IEEE TNS 65 (2018), Table II): extruded polystyrene + 1.5% PTP
/// + 0.01% POPOP tile, 7 mm; Kuraray Y11(200) single-clad 1 mm WLS fiber glued (EPO-TEK 301) in its groove;
/// 50 um painted reflector; Al foil + cling film + black vinyl wrap; black coupler holding the SiPM.
///
/// Photosensor (sPHENIX HCal prototype / production lineage):
///   Hamamatsu S12572-33-015P (MPPC), 3×3 mm², 15 μm pixels (~40k),
///   PDE ~25% (nominal, device average at green), operated a few volts over
///   breakdown (Aidala et al., IEEE TNS 65 (2018); T-1044 beam test).
/// Dual fiber ends couple through a plastic mount with a ~0.75 mm air gap to
/// the SiPM face to reduce optical saturation.
class HcalTileDetectorConstruction : public G4VUserDetectorConstruction {
public:
  explicit HcalTileDetectorConstruction(const G4String& gdmlPath);
  virtual ~HcalTileDetectorConstruction();

  virtual G4VPhysicalVolume* Construct() override;
  virtual void ConstructSDandField() override;

  void SetPDE(G4double pde) { fPDE = pde; }
  G4double GetPDE() const { return fPDE; }

  /// Hamamatsu S12572-33-015P part string (for logs / documentation).
  static constexpr const char* kSipmPartNumber = "Hamamatsu S12572-33-015P";

private:
  void AttachOpticalProperties();
  void SetupSurfaces(G4VPhysicalVolume* world, G4VPhysicalVolume* tile, G4VPhysicalVolume* block);

  G4String fGdmlPath;
  G4double fScintYield = 8000.;   // ph/MeV: extruded PS + PTP/POPOP [EST, tune to measured p.e./MIP]
  G4double fWLSEff = 0.90;
  /// Hamamatsu S12572-015P: ~25% PDE (sPHENIX HCal papers); not MicroFC.
  G4double fPDE = 0.25;
  /// Air gap fiber-end to SiPM face [mm] (sPHENIX tile coupler design).
  G4double fAirGapMm = 0.75;
  G4OpticalSurface* fReflectorSurf = nullptr;
  G4OpticalSurface* fCouplerSurf = nullptr;
};

#endif
