
#include "GTActionInitialization.hh"
#include "GTPrimaryGeneratorAction.hh"
#include "GTRunAction.hh"
#include "GTEventAction.hh"
#include "GTSteppingAction.hh"

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

GTActionInitialization::GTActionInitialization()
 : G4VUserActionInitialization()
{}

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

GTActionInitialization::~GTActionInitialization()
{}

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

void GTActionInitialization::BuildForMaster() const
{
  GTRunAction* runAction = new GTRunAction;
  SetUserAction(runAction);
}

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......

void GTActionInitialization::Build() const
{
  SetUserAction(new GTPrimaryGeneratorAction);

  GTRunAction* runAction = new GTRunAction;
  SetUserAction(runAction);
  
  GTEventAction* eventAction = new GTEventAction(runAction);
  SetUserAction(eventAction);
  
  SetUserAction(new GTSteppingAction(eventAction));
}  

//....oooOO0OOooo........oooOO0OOooo........oooOO0OOooo........oooOO0OOooo......
