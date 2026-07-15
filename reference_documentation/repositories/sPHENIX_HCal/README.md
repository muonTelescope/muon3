# HCal 
This code is created for a quick test of detector geometry using gdml in GEANT4. 

For testing different geometry, one only needs to input a gdml file in GTDetectorConstruction.cc at 'parser.Read("xxx.gdml")'.

The stepping and primary generator actions are coded for very primative tests. Serious users should modify these for their specific needs.

The current code works well with Ubuntu 20.04 and multithreaded G4 simulation.

# Updated: March 9, 2024, Xiaochun He
1. Renamed the project from geomTest to HCal
2. The steering gdml file, which is read in by the geometry constructor, called sPHENIX_HCal.gdml. This means that one needs to link it to the real gdml file before running the simulation 
