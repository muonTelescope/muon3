# Muon3: Networked Cosmic-Ray Muon Telescope

Muon3 is the engineering archive and next-generation development workspace for the
[Muon Telescope](https://muontelescope.com/) and
[gLOWCOST](https://cosmic.gsu.edu/glowcost/) detector program led by Georgia State University.

The project is developing a portable, remotely operated cosmic-ray telescope built from
plastic-scintillator panels, wavelength-shifting fibers, silicon photomultipliers (SiPMs),
precision timing electronics, GNSS, and cellular connectivity. The initial scientific priorities
are:

1. inter-station extensive-air-shower coincidence;
2. long-duration atmospheric and space-weather muon-rate monitoring; and
3. directional tracking with multiple scintillator layers.

This repository also preserves the complete earlier hardware and software lineage. Twenty-eight
upstream `muonTelescope` repositories are retained as Git submodules so their original commits,
branches, tags, and remotes remain available.

> **Engineering status:** research and architecture phase. The included 2026 Rev A KiCad design
> is reference material, not a fabrication release. It has known electrical blockers and no routed
> tracks. Read the [PCB review](reference_documentation/review_and_requirements/NEXT_GENERATION_PCB_REVIEW.md)
> before using any schematic, simulation result, footprint, or BOM.

## Baseline detector concept

The baseline station uses three or more detector layers. Each layer is based on:

- a 200 x 200 x 10 mm plastic-scintillator panel;
- a glued, embedded wavelength-shifting optical fiber routed in a loop;
- an onsemi MicroFC-30035 SiPM;
- a local temperature sensor and optional thermoelectric cooler; and
- a grounded coaxial signal connection plus a separate, keyed auxiliary connection for bias,
  thermal sensing, and TEC power.

The four-channel controller is intended to provide:

- DC-coupled SiPM transimpedance amplification;
- two programmable comparator thresholds per channel;
- leading- and trailing-edge capture for time-over-threshold measurements;
- exact-subset coincidence counting;
- continuous accidental-rate estimation using delayed shadow windows;
- per-channel charge and optical self-test injection;
- GNSS PPS-disciplined timestamps;
- environmental and power telemetry;
- USB-C Power Delivery; and
- LTE-M/NB-IoT connectivity through a directly integrated nRF9151-LACA.

## Proposed system architecture

```text
Scintillator panel
  -> looped wavelength-shifting fiber
  -> MicroFC-30035 SiPM
  -> DC-coupled TIA
  -> dual fast comparators
  -> iCE40UP5K timing and histogram engine
  -> SPI register interface
  -> nRF9151-LACA control, storage, GNSS coordination, and cellular telemetry
```

Supporting subsystems include:

```text
USB-C PD / battery / solar input
  -> protected power path
  -> quiet analog rail
  -> digital and FPGA rails
  -> programmable SiPM bias
  -> four independent TEC controller channels
```

The timing/control partition is deliberate:

- **iCE40UP5K:** deterministic parallel pulse capture, coincidences, timestamps, ToT, histograms,
  livetime/deadtime, PPS latching, and calibration timing.
- **nRF9151-LACA:** configuration, DAC/ADC/sensor access, thermal and bias control loops, local
  buffering, secure OTA, device identity, and LTE-M/NB-IoT reporting.

## Next-generation requirements

The controlling requirements are documented in
[NEXT_GENERATION_REQUIREMENTS.md](reference_documentation/review_and_requirements/NEXT_GENERATION_REQUIREMENTS.md).
Major decisions currently include:

- MicroFC-30035 production SiPM;
- 20 x 20 x 1 cm loop-fiber baseline panels;
- directly integrated nRF9151-LACA rather than a generic carrier header;
- Onomondo or Deutsche Telekom nuSIM/eSIM plus physical SIM support;
- USB-C PD with safe 5 V fallback and higher-power TEC modes;
- a clean 5 V analog rail for the proposed OPA858 operating point;
- independent baseline trim and dual-threshold ToT on all four channels;
- at least sixteen precision DAC outputs;
- conventional grounded coax shields instead of exposed bias on the shield;
- one cold-side NTC and preferably one hot-side NTC per SiPM/TEC channel;
- four independently regulated, dew-point-aware Peltier channels; and
- pressure-corrected and uncorrected scientific data products with full configuration provenance.

## Known release blockers

The existing generated Rev A design must not be ordered. The review identified, among other
issues:

1. **OPA858 common-mode violation.** The amplifier is powered from 3.3 V while its inputs are
   biased at 2.40 V. The current TI specification permits approximately 1.9 V maximum at that
   supply. The supplied behavioral model does not simulate this limit.
2. **iCE40 VCCPLL overvoltage.** VCCPLL is connected to 3.3 V; Lattice specifies a 1.2 V rail
   and a 1.42 V absolute maximum.
3. **Unrouted PCB.** The board contains footprints, zones, and stitching vias but zero routed
   track segments. Placement-only DRC is not a fabrication validation.
4. **Incomplete power and RF design.** USB-C PD, protected battery/solar power path,
   nRF9151-LACA reference RF layout, SIM protection, antenna matching, and cellular burst power
   integrity remain to be implemented.
5. **Incomplete calibration and thermal hardware.** Charge injection, optical injection, four
   complete NTC channels, TEC power stages, dew-point interlocks, and heat rejection are not in
   the Rev A schematic.
6. **No production RTL or nRF firmware.** The requested timing engine and secure fleet software
   remain specifications. Historical FPGA and RP2350 code is reference-only.

See the detailed
[Next-Generation PCB Review](reference_documentation/review_and_requirements/NEXT_GENERATION_PCB_REVIEW.md)
for the evidence, subsystem findings, questions, and recommended work order.

## Repository layout

```text
.
├── README.md
├── .gitmodules
└── reference_documentation/
    ├── README.md
    ├── repositories/            # 28 historical Git submodules
    ├── publications/            # archived GSU and sPHENIX papers + index
    ├── prior_design_exports/    # chat history, decisions, handoffs, source packages
    ├── next_generation/         # KiCad, simulations, generators, reference firmware
    ├── review_and_requirements/ # active system review and requirements
    └── working_files/           # retained render/review intermediates
```

The main entry points are:

- [Archive index](reference_documentation/README.md)
- [Next-generation requirements](reference_documentation/review_and_requirements/NEXT_GENERATION_REQUIREMENTS.md)
- [PCB and system review](reference_documentation/review_and_requirements/NEXT_GENERATION_PCB_REVIEW.md)
- [Publication index](reference_documentation/publications/README.md)
- [Historical decision log](reference_documentation/prior_design_exports/DECISIONS.md)
- [Historical design conversation](reference_documentation/prior_design_exports/CHAT_HISTORY.md)
- [Current reference hardware notes](reference_documentation/next_generation/nextgen_review/hardware/README.md)
- [Analog simulation report](reference_documentation/next_generation/nextgen_review/sim/design_report.md)

## Clone and initialize

Clone the umbrella repository and all historical projects:

```sh
git clone --recurse-submodules git@github.com:muonTelescope/muon3.git
cd muon3
```

If the repository was cloned without submodules:

```sh
git submodule update --init --recursive
```

To update every historical repository to the commit recorded by Muon3:

```sh
git submodule update --init --recursive
```

Do not run `git submodule update --remote` unless intentionally reviewing newer upstream
commits; it changes the reproducible archive state.

## Working with the hardware package

The unpacked reference package is under:

```text
reference_documentation/next_generation/nextgen_review/
```

Important paths:

- `hardware/muon_telescope_v10/` - primary KiCad project;
- `hardware/muon_telescope_v7/` - legacy validation twin;
- `hardware/generator/` - schematic/symbol/PCB generators;
- `sim/` - behavioral ngspice models, analysis scripts, plots, and design report; and
- `rp2350_reference/` - superseded protocol and capture prototype.

Before editing generated EDA files, read the package `AGENTS.md`, decision log, hardware README,
and simulation report. Until the generators are retired, schematic changes should be made in the
generators and regenerated consistently. Once manual routing begins, ownership of the PCB file
must be explicitly frozen so a generator cannot overwrite hand routing.

Every hardware revision must include:

1. manufacturer-datasheet pin and operating-point verification;
2. KiCad 10 ERC and DRC;
3. exported-netlist assertions for critical rails and signals;
4. BOM/footprint/LCSC verification against the exact ordered parts;
5. power-up, power-down, fault, and unpowered-input analysis;
6. analog coupon or bench results tied to the simulation set;
7. synthetic-pulse RTL tests and clock-domain/metastability review; and
8. an independent schematic and layout peer review.

## Data products and calibration

Muon3 is intended to produce auditable scientific measurements rather than bare event counts.
Each report should retain:

- station and detector geometry identifiers;
- firmware, RTL, configuration, and calibration versions;
- raw singles and exact-subset coincidence counts;
- dual-threshold ToT histograms and shadow-window accidentals;
- livetime, deadtime, dropped-event, overflow, and reset counters;
- UTC/PPS lock state, measured clock frequency, timing uncertainty, and holdover state;
- thresholds, baselines, bias setpoint/readback, and injection-test results;
- SiPM, TEC hot-side, enclosure, and ambient temperatures;
- humidity, pressure, dew point, TEC current/power, and supply telemetry; and
- both raw and pressure-corrected rate products with the applied coefficient/version.

The historical publications validate the detector geometry and network use case but do not supply
a transferable single-photoelectron-calibrated yield for the current MicroFC loop-panel assembly.
Measured single-p.e., dark-rate, muon-efficiency, timing, and temperature data from representative
finished panels must drive the final analog gain and thresholds.

## Peltier cooling constraints

Cooling is intended to reduce SiPM dark rate and stabilize gain, not to reach the lowest possible
temperature. The baseline control policy is:

- fixed-temperature, fixed-delta, or dew-point-limited operation;
- remain at least 3 degC above calculated dew point unless the cold cavity is sealed and dry;
- default every TEC off on missing/invalid NTC data, hot-side overtemperature, fan failure,
  insufficient USB-PD contract, overcurrent, or firmware loss; and
- report cold-side temperature, hot-side temperature, current, voltage, control state, and all
  thermal interlocks.

MAX1968-class bipolar +/-3 A TEC control is a provisional candidate. TEC switching converters and
heat-rejection hardware must be isolated from the analog front end through physical placement,
filtered power branches, controlled return paths, shielding where justified, and acquisition-aware
switching/blanking tests.

## Research background

The archive includes:

- He et al., *Hybrid Portable Low-cost and Modular Cosmic Ray Muon and Neutron Detector*,
  PoS(ICRC2019)078;
- Aidala et al., *Design and Beam Test Results for the sPHENIX Electromagnetic and Hadronic
  Calorimeter Prototypes*, IEEE TNS 65 (2018); and
- a link to Mubashir et al., *Muon Flux Variations Measured by Low-Cost Portable Cosmic Ray
  Detectors and Their Correlation With Space Weather Activity*, JGR Space Physics 128 (2023).

The GSU work confirms the three-layer 20 cm panel lineage, real-world coincidence-rate scale, and
the importance of pressure and temperature correction. See the
[publication index](reference_documentation/publications/README.md) for local files and design
interpretation.

## Development roadmap

Recommended order:

1. import and analyze the existing single-p.e./muon/temperature measurements;
2. freeze layer count, spacing, acceptance, and tracking requirements;
3. select the exact SiPM package, TEC, thermal stack, nRF antenna, USB-PD/power-path parts,
   DACs, ADC, and regulators;
4. correct the analog and FPGA supply blockers;
5. build and characterize a one-channel analog/TEC test coupon;
6. specify and verify the FPGA register map and timing engine;
7. implement secure nRF9151 telemetry, buffering, OTA, and recovery;
8. complete the schematic and safe-state/fault analysis;
9. route, review, and manufacture an engineering prototype; and
10. perform EVT/DVT environmental, EMC, timing, calibration, and fleet-recovery testing.

## Contribution discipline

- Keep historical submodules pinned unless an update is intentional and documented.
- Do not treat a simulation result as component-level validation unless the model covers the
  relevant operating limits.
- Do not order generated hardware without current datasheet, netlist, ERC, DRC, BOM, footprint,
  and peer-review evidence.
- Record architecture decisions and rejected alternatives with quantitative reasoning.
- Preserve raw measurements and the scripts needed to reproduce every derived plot or threshold.
- Use SI units and include tolerances, environmental range, and verification status in design
  claims.

## License and third-party material

No single umbrella license has yet been selected. Historical submodules retain their individual
licenses and copyright. Bundled vendor/community libraries and public papers retain their own
license terms. Review those terms before redistribution, modification, or commercial use.

