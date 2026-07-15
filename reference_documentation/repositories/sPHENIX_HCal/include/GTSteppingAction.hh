// Feb 8, 2021: Hexc and Zachary
// A simple and quick geometry test project using GEANT4
//

#ifndef GTSteppingAction_h
#define GTSteppingAction_h 1

#include "G4UserSteppingAction.hh"
#include "globals.hh"

class GTEventAction;

class G4LogicalVolume;

/// Stepping action class
/// 

class GTSteppingAction : public G4UserSteppingAction
{
  public:
    GTSteppingAction(GTEventAction* eventAction);
    virtual ~GTSteppingAction();

    // method from the base class
    virtual void UserSteppingAction(const G4Step*);

  private:
    GTEventAction*  fEventAction;
    G4LogicalVolume* fScoringVolume;
};

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

#endif
