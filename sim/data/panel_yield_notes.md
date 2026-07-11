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

Use Geant4 output + bench measurement to anchor the ngspice NPE scale.

Recommended: store one CSV per panel batch with columns:
`panel_id, position_x, position_y, angle_deg, temp_C, ov_V, npe_mean, npe_sigma, dark_rate_hz`
