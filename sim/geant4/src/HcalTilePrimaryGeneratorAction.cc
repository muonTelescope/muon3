#include "HcalTilePrimaryGeneratorAction.hh"

#include "G4ParticleGun.hh"
#include "G4ParticleTable.hh"
#include "G4SystemOfUnits.hh"
#include "Randomize.hh"
#include <cmath>

HcalTilePrimaryGeneratorAction::HcalTilePrimaryGeneratorAction(
    G4double x0, G4double y0, G4double z0, G4double halfX, G4double halfY)
  : fX0(x0), fY0(y0), fZ0(z0), fHalfX(halfX), fHalfY(halfY) {
  fParticleGun = new G4ParticleGun(1);
  auto* muon = G4ParticleTable::GetParticleTable()->FindParticle("mu-");
  fParticleGun->SetParticleDefinition(muon);
  fParticleGun->SetParticleEnergy(4.0 * GeV);
  fParticleGun->SetParticleMomentumDirection(G4ThreeVector(0, 0, -1));
}

HcalTilePrimaryGeneratorAction::~HcalTilePrimaryGeneratorAction() {
  delete fParticleGun;
}

void HcalTilePrimaryGeneratorAction::GeneratePrimaries(G4Event* event) {
  // Uniform over central 80% of tile face
  G4double x = fX0 + (G4UniformRand() - 0.5) * 2.0 * fHalfX * 0.8;
  G4double y = fY0 + (G4UniformRand() - 0.5) * 2.0 * fHalfY * 0.8;
  G4double z = fZ0 + 50. * mm;
  fParticleGun->SetParticlePosition(G4ThreeVector(x, y, z));

  G4double theta = 0.0;
  do {
    theta = G4UniformRand() * (50. * deg);
  } while (G4UniformRand() > std::pow(std::cos(theta), 2.0));
  G4double phi = G4UniformRand() * 360. * deg;
  G4ThreeVector dir(std::sin(theta) * std::cos(phi),
                     std::sin(theta) * std::sin(phi),
                     -std::cos(theta));
  fParticleGun->SetParticleMomentumDirection(dir);

  G4double eMin = 0.5 * GeV, eMax = 50. * GeV;
  G4double u = G4UniformRand();
  G4double E = std::pow(std::pow(eMin, -1.7) + u * (std::pow(eMax, -1.7) - std::pow(eMin, -1.7)),
                        -1. / 1.7);
  fParticleGun->SetParticleEnergy(E);
  fParticleGun->GeneratePrimaryVertex(event);
}
