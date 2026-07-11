#ifndef PanelActionInitialization_h
#define PanelActionInitialization_h 1

#include "G4VUserActionInitialization.hh"

/// Action initialization for multi-threaded Geant4.
/// Registers generator, run, event, and stepping actions.
class PanelActionInitialization : public G4VUserActionInitialization
{
public:
  PanelActionInitialization() = default;
  virtual ~PanelActionInitialization() = default;

  virtual void BuildForMaster() const override;
  virtual void Build() const override;
};

#endif
