#include "PanelPrimaryGeneratorAction.hh"

#include "G4ParticleGun.hh"
#include "G4ParticleTable.hh"
#include "G4SystemOfUnits.hh"
#include "Randomize.hh"

PanelPrimaryGeneratorAction::PanelPrimaryGeneratorAction() {
  fParticleGun = new G4ParticleGun(1);
  auto* particleTable = G4ParticleTable::GetParticleTable();
  auto* muon = particleTable->FindParticle("mu-");
  fParticleGun->SetParticleDefinition(muon);
  fParticleGun->SetParticleEnergy(3.0 * GeV);  // typical MIP-ish cosmic
  fParticleGun->SetParticleMomentumDirection(G4ThreeVector(0, 0, -1)); // downward
}

PanelPrimaryGeneratorAction::~PanelPrimaryGeneratorAction() {
  delete fParticleGun;
}

void PanelPrimaryGeneratorAction::GeneratePrimaries(G4Event* event) {
  // Simple vertical or slightly randomized direction around center of panel
  G4double x = (G4UniformRand() - 0.5) * 160.*mm;
  G4double y = (G4UniformRand() - 0.5) * 160.*mm;
  G4double z =  80.*mm;   // above panel

  fParticleGun->SetParticlePosition(G4ThreeVector(x, y, z));

  // Small angular spread
  G4double theta = (G4UniformRand() - 0.5) * 0.4; // rad
  G4double phi   = G4UniformRand() * 360.*deg;
  G4ThreeVector dir(std::sin(theta)*std::cos(phi), std::sin(theta)*std::sin(phi), -std::cos(theta));
  fParticleGun->SetParticleMomentumDirection(dir);

  fParticleGun->GeneratePrimaryVertex(event);
}
