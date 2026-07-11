# Panel Yield Notes (Muon3)

**Target parameters to measure on representative panels before freezing thresholds:**

- Single photoelectron response (amplitude, charge, ToT) at operating overvoltage and temperature.
- MIP muon peak position (most probable NPE after fiber collection + SiPM PDE).
- Position map of light yield across the 200x200 mm area.
- Temperature coefficient of gain and of light output.
- Afterpulse / crosstalk probability.
- Fiber attenuation and loop uniformity (two ends vs one end).

**Historical references**
- Old readme: "~30 photons" reaching sensor (very rough).
- GSU ICRC2019 and sPHENIX papers in `reference_documentation/publications/`.

**Related Geant4 models from phyxch (same collaboration)**

Cloned under `reference_documentation/repositories/`:

- `fiberPanel/` (https://github.com/phyxch/fiberPanel):
  - Straight embedded Y-11 fiber (configurable position via runConfig), 20 cm class EJ-200 panel.
  - Material defs: EJ200 at 1.023 g/cm³ with H 52.43% / C 47.57% mass fractions; WLS fiber; EJ-500 optical cement; PMMA cladding; G4_Al wrapping with square hole for SiPM.
  - Optical: full G4OpticalPhysics (scintillation, WLS, absorption, boundary); position scan studies for collection efficiency.
  - SiPM SD: simple optical photon hit counter (PDE / QE typically applied downstream).
  - Notes from code history: production scintillation yield often ~10k ph/MeV range (reduced to 100 for viz/debug); recent G4 11.x updates.
  - Use: cross-check light yield vs. fiber offset, surface polish assumptions, wrapping reflectivity, optical cement coupling. Current muon3 model uses a *looped* fiber path for better area coverage.

- `magnetocosmics/`: geomagnetic tracking of cosmic showers. Future: replace simple PrimaryGenerator with realistic angular + energy spectrum + rate.

See also local `repositories/scintillatorPanel/` (looped fiber CAD, 1.3 mm ball-mill groove, Kuraray K-11, reflective coatings).

Use Geant4 output + bench measurement to anchor the ngspice NPE scale.

Recommended: store one CSV per panel batch with columns:
`panel_id, position_x, position_y, angle_deg, temp_C, ov_V, npe_mean, npe_sigma, dark_rate_hz`
