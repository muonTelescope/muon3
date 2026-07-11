#ifndef PANEL_PHYSICS_LIST_HH
#define PANEL_PHYSICS_LIST_HH

#include "G4VModularPhysicsList.hh"

class PanelPhysicsList : public G4VModularPhysicsList {
public:
  PanelPhysicsList();
  virtual ~PanelPhysicsList() = default;
  virtual void SetCuts() override;
};

#endif
