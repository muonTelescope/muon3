#!/bin/bash
# Build script for Muon3Vision (requires Xcode)
# Usage: ./build_visionpro.sh
# Then open the generated project or use xcodebuild after setting up project.

echo "Muon3Vision build helper"
echo "1. Open Xcode and create a visionOS App project named Muon3Vision."
echo "2. Add the Sources and Resources folders."
echo "3. Pair your Vision Pro device in Xcode (Window > Devices and Simulators)."
echo "4. Build and Run on the paired device."
echo "Data from sim/geant4/hits.csv is bundled for real visualizations."
echo "For ngspice, extend SimulationManager with waveform loading from sim/circuit/results/."
echo "Build complete in instructions."
