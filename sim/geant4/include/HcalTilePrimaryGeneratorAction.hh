#ifndef HCAL_TILE_PRIMARY_GENERATOR_ACTION_HH
#define HCAL_TILE_PRIMARY_GENERATOR_ACTION_HH

#include "G4VUserPrimaryGeneratorAction.hh"
#include "G4ThreeVector.hh"
#include "globals.hh"

class G4ParticleGun;
class G4Event;

/// Cosmic-like muons aimed at an sPHENIX Inner HCal tile face.
class HcalTilePrimaryGeneratorAction : public G4VUserPrimaryGeneratorAction {
public:
  HcalTilePrimaryGeneratorAction(G4double x0, G4double y0, G4double z0,
                                 G4double halfX, G4double halfY);
  virtual ~HcalTilePrimaryGeneratorAction();
  virtual void GeneratePrimaries(G4Event* event) override;

private:
  G4ParticleGun* fParticleGun = nullptr;
  G4double fX0, fY0, fZ0, fHalfX, fHalfY;
};

#endif
