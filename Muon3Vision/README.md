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
