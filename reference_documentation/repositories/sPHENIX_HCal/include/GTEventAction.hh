// Feb 8, 2021: Hexc and Zachary
// A simple and quick geometry test project using GEANT4
//

#ifndef GTEventAction_h
#define GTEventAction_h 1

#include "G4UserEventAction.hh"
#include "globals.hh"

class GTRunAction;

/// Event action class
///

class GTEventAction : public G4UserEventAction
{
  public:
    GTEventAction(GTRunAction* runAction);
    virtual ~GTEventAction();

    virtual void BeginOfEventAction(const G4Event* event);
    virtual void EndOfEventAction(const G4Event* event);

    void AddEdep(G4double edep) { fEdep += edep; }

  private:
    GTRunAction* fRunAction;
    G4double     fEdep;
};

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

#endif

    
