#ifndef PANEL_EVENT_ACTION_HH
#define PANEL_EVENT_ACTION_HH

#include "G4UserEventAction.hh"
#include "globals.hh"
#include <string>

class PanelEventAction : public G4UserEventAction {
public:
  PanelEventAction();
  virtual ~PanelEventAction() = default;

  virtual void BeginOfEventAction(const G4Event* event) override;
  virtual void EndOfEventAction(const G4Event* event) override;

  // Accumulators called from SD / stepping
  void AddScintEnergy(G4double de) { fEdepScint += de; }
  void AddPhotonProduced(G4int n)  { fPhotonsProduced += n; }
  void AddPhotonShifted(G4int n)   { fPhotonsShifted += n; }
  void AddPhotonDetected(G4int n)  { fPhotonsDetected += n; }

  /// Enable effective SiPM yield when full optical transport to the SiPM is
  /// incomplete (tessellated tile + segmented fiber). Model:
  ///   ⟨N_pe⟩ = (E_dep / MeV) × scintYield × collectionEff × PDE
  /// Used for sPHENIX HCal tiles with Hamamatsu S12572-33-015P (PDE~0.25).
  void EnableEffectiveSipmYield(G4double scintYieldPerMeV, G4double collectionEff,
                                G4double pde, const G4String& sipmPart);

private:
  G4double fEdepScint = 0.;
  G4int    fPhotonsProduced = 0;
  G4int    fPhotonsShifted  = 0;
  G4int    fPhotonsDetected = 0;
  G4int    fEventID = 0;

  G4bool   fUseEffectiveYield = false;
  G4double fScintYieldPerMeV = 10000.;
  G4double fCollectionEff = 0.012;
  G4double fPDE = 0.25;
  G4String fSipmPart = "SiPM";
};

#endif
