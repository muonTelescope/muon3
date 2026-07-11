# Muon3Vision - Apple Vision Pro Simulation Visualizer

High-quality 3D visualization app for the Muon3 muon telescope simulations, built for Apple Vision Pro (visionOS).

## Focus
- **Excellent User Interface**: Spatial, intuitive controls using gaze, pinch, and direct manipulation. Clean SwiftUI windows with immersive elements.
- **High Quality Visualization**: Leverages RealityKit for physically-based rendering, advanced particle systems, dynamic lighting, and smooth animations to represent muon interactions, scintillation, WLS fiber photon transport, and SiPM detection.

## Key Features
- Immersive 3D model of the 200x200x10 mm EJ-200 panel with looped WLS fiber and MicroFC-30035 SiPM.
- Real-time or replayed simulation from Geant4 data (hits.csv).
- Animated muon tracks, photon bursts, fiber glow, and hit visualization.
- UI controls: sliders for muon energy/angle/position, play/pause, event scrubber, stats panel (NPE, timing, efficiency).
- High-fidelity: Custom materials, particle trails with color shift (blue scintillation to green WLS), environment lighting, shadows.
- Interactions: Grab and rotate the panel, pinch to zoom into fiber, tap SiPM for details.

## Project Setup
1. Create a new visionOS App project in Xcode (App template, SwiftUI + RealityKit).
2. Replace the generated files with the ones in this directory.
3. Add the `sim/geant4/hits.csv` to the app's resources.
4. For high quality assets: Import a detailed USDZ model of the panel/fiber (or use procedural geometry provided).
5. Run on Vision Pro simulator or device. Use "Immersive Space" for full experience.

## Architecture for Quality
- **RealityView**: Core 3D scene with Entity-Component system.
- **Particle Systems**: For photons (high particle count, custom shaders if needed).
- **Animations**: Timeline-based for photon propagation timing matching ~ns scale stretched for visibility.
- **UI**: Mixed 2D windows + 3D ornaments. Uses visionOS glassmorphism, hover states.
- **Performance**: Level of detail, culling for high quality at 90+ fps.

See the Swift files for implementation details. This provides a production-ready starting point focused on polish and immersion.

Built to visualize the Muon3 Geant4 + system simulations in spatial computing.

## Building and Running on Paired Vision Pro Device

1. Open Xcode (16+ recommended).
2. Create new visionOS > App project (or add target to existing).
3. Drag the Sources/Muon3Vision/*.swift into the project.
4. Add the Resources/ folder (including AppIcon and logo).
5. Copy sim/geant4/hits.csv into the app bundle (or use the dev path in SimulationManager).
6. In project settings: set minimum visionOS to 1.0+, enable Immersive Space.
7. Pair your Vision Pro: Xcode > Window > Devices and Simulators > + (pair via WiFi or USB).
8. Select the Vision Pro as destination and Run (Cmd+R).
9. The app will launch in a window + Immersive Space. Use the window to load data and trigger animations in 3D.

High-quality viz uses RealityKit particle systems driven by real Geant4 hits.csv data (muon position, photon counts).

If using the Package.swift, you can experiment with `xcodebuild` but full app requires Xcode project.


## Additional Recommendations Implemented
- Real Geant4 data (hits.csv) loaded and visualized in 3D: muon impacts at real (x,y), photon particles scaled by detected/produced, fiber glow by shifted+detected, SiPM flash by detected.
- Color coding: burst color by edep (red for high, blue for low).
- UI enhancements: animation speed slider, color mode picker (by detected/edep/produced), ngspice timing overlay toggle (with synthetic waveform based on event time for demo; extend with real wave_dual_n*.csv).
- ngspice integration: loadNgspiceWaveform() in manager; simple bar viz in UI for waveform (extend for full ngspice plots).
- High quality: more particles, timed animations, emissive materials, lights for hits.
- Build/run: build_visionpro.sh helper + detailed Xcode + paired device instructions (pair via Devices and Simulators, run on headset for immersive 3D data viz).

To test data viz: load real hits, select event, play in immersive - see data-driven photons, color by edep, stats.

For full ngspice: add load for results/wave_dual_n*.csv and animate a 2D line or particles over time in overlay.

