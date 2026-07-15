#ifndef HCAL_TILE_ACTION_INITIALIZATION_HH
#define HCAL_TILE_ACTION_INITIALIZATION_HH

#include "G4VUserActionInitialization.hh"
#include "globals.hh"

class HcalTileActionInitialization : public G4VUserActionInitialization {
public:
  HcalTileActionInitialization(G4double x0, G4double y0, G4double z0,
                               G4double halfX, G4double halfY);
  virtual ~HcalTileActionInitialization() = default;
  virtual void Build() const override;
  virtual void BuildForMaster() const override;

private:
  G4double fX0, fY0, fZ0, fHalfX, fHalfY;
};

#endif
