// Feb 8, 2021: Hexc and Zachary
// A simple and quick geometry test project using GEANT4
//

#ifndef GTActionInitialization_h
#define GTActionInitialization_h 1

#include "G4VUserActionInitialization.hh"

/// Action initialization class.

class GTActionInitialization : public G4VUserActionInitialization
{
  public:
    GTActionInitialization();
    virtual ~GTActionInitialization();

    virtual void BuildForMaster() const;
    virtual void Build() const;
};

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

#endif

    
