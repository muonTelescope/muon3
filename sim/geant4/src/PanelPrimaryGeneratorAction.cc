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
  // Typical sea-level cosmic muon mean energy ~ few GeV; we sample a simple power-law spectrum
  fParticleGun->SetParticleEnergy(4.0 * GeV);
  fParticleGun->SetParticleMomentumDirection(G4ThreeVector(0, 0, -1));
}

PanelPrimaryGeneratorAction::~PanelPrimaryGeneratorAction() {
  delete fParticleGun;
}

void PanelPrimaryGeneratorAction::GeneratePrimaries(G4Event* event) {
  // Position: uniform over central 160x160 mm of panel
  G4double x = (G4UniformRand() - 0.5) * 160.*mm;
  G4double y = (G4UniformRand() - 0.5) * 160.*mm;
  G4double z =  100.*mm;

  fParticleGun->SetParticlePosition(G4ThreeVector(x, y, z));

  // Realistic cosmic angular distribution: ~ cos^2(theta) for vertical muons (theta from zenith)
  // Sample theta with weight cos^2, phi uniform; clamp to reasonable range
  G4double theta = 0.0;
  do {
    theta = G4UniformRand() * (60.*deg);  // up to 60 deg from vertical
  } while (G4UniformRand() > std::pow(std::cos(theta), 2.0));

  G4double phi = G4UniformRand() * 360.*deg;
  G4ThreeVector dir(std::sin(theta)*std::cos(phi), std::sin(theta)*std::sin(phi), -std::cos(theta));
  fParticleGun->SetParticleMomentumDirection(dir);

  // Simple power-law energy sampling (index ~ -2.7 for differential flux, mean a few GeV)
  G4double eMin = 0.5*GeV, eMax = 50.*GeV;
  G4double u = G4UniformRand();
  G4double E = std::pow( std::pow(eMin, -1.7) + u*(std::pow(eMax,-1.7) - std::pow(eMin,-1.7)) , -1./1.7 );
  fParticleGun->SetParticleEnergy(E);

  fParticleGun->GeneratePrimaryVertex(event);
}
