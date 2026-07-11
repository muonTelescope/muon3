#ifndef PANEL_PRIMARY_GENERATOR_ACTION_HH
#define PANEL_PRIMARY_GENERATOR_ACTION_HH

#include "G4VUserPrimaryGeneratorAction.hh"
#include "G4ParticleGun.hh"

class G4Event;

class PanelPrimaryGeneratorAction : public G4VUserPrimaryGeneratorAction {
public:
  PanelPrimaryGeneratorAction();
  virtual ~PanelPrimaryGeneratorAction();
  virtual void GeneratePrimaries(G4Event* event) override;

private:
  G4ParticleGun* fParticleGun = nullptr;
};

#endif
