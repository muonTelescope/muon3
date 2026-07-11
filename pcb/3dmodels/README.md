# Muon3 3D Models (STEP)

This directory contains STEP (.step / .stp) 3D mechanical models for components used on the Muon3 PCB.

## Usage in KiCad

- Footprints in `../components/muon3.pretty/` reference models using `${KIPRJMOD}/3dmodels/NAME.step`.
- For JLCPCB library parts (in `../components/JLCPCB-Kicad-Library/`), the associated models are expected to be resolved from your KiCad 3D model search paths (the copied library is paired with the standard JLCPCB.3dshapes set). You can also copy matching models here and override per-footprint as needed.
- Open the board in KiCad, go to 3D viewer (or footprint properties) to verify placement/offset/rotation. Adjust offsets as required for correct pin-1 orientation and centering.

## Sources

- Custom / verified models copied from prior validated muon telescope projects (nRF9151, iCE40UP5K).
- Package approximations and common parts sourced from the CDFER/JLCPCB KiCad library 3D shapes (installed via KiCad package manager or sync).
- SiPM proxy: S13360-2050VE (similar Hamamatsu SMD SiPM) used as stand-in for MicroFC-30035 mechanical envelope until official Onsemi model is integrated.
- Passives and standard discretes: generic from JLCPCB set (0402/0603/0805 etc. if added).

## Included models (as of 2026-07-11)

| File                        | Used for / approximates                  | Notes |
|-----------------------------|------------------------------------------|-------|
| nRF9151_LGA113.step        | nRF9151-LACA-R7 (LGA-113)                | Full module, from prior project |
| ICE40UP5K_SG48I_QFN48.step | ICE40UP5K-SG48I (QFN-48-EP)              | From prior mppcInterface |
| USB_C_Receptacle.step      | USB-C 16P receptacle                     | HX-TYPE-C-16PIN equivalent |
| UFL_IPEX.step              | U.FL / IPEX RF connector                 | Murata/Hirose style |
| BME280_LGA8.step           | BME280 (LGA-8)                           | Bosch package |
| WSON8_ESOP8.step           | OPA858IDSGR (WSON-8 2x2 EP)              | ESOP-8 approx for WSON |
| DFN_WSON_approx.step       | TPS61170DRVR (WSON-6)                    | Generic small DFN/WSON proxy |
| TSSOP10.step               | CH224K (ESSOP-10-EP)                     | Approx package |
| TSSOP24_HTSSOP.step        | DRV8873 (HTSSOP-24-EP)                   | TSSOP-24 approx |
| SOIC8.step                 | W25Q128 etc (SOIC-8)                     | Common flash |
| SOT23-*.step               | Comparators (TLV3601), FETs (AO3400A)    | SOT-23-3/5/6 |
| S13360_SiPM.stp            | MicroFC-30035 / SiPMs (proxy)            | For detector panel viz |
| QFN56.step                 | Larger QFNs if used                      | - |

## Adding more

1. Download manufacturer or SnapEDA/UltraLibrarian STEP for exact MPN.
2. Place here with descriptive name.
3. Add `(model ...)` entry to the matching `.kicad_mod`.
4. Re-verify alignment in KiCad 3D viewer after pad layout is finalized.

For the scintillator panel, WLS fiber, and enclosure, see top-level `../reference_documentation/repositories/cad/` (SolidWorks/STEP assemblies from prior iterations) and Geant4 geometry.

## License note

3D models are provided for visualization and mechanical fit only. Verify against latest datasheet dimensions before ordering parts or finalizing enclosure. Respect original licensor terms (many JLC models are for use with their parts).
