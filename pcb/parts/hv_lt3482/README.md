# LT3482 — SiPM / APD high-voltage bias (HCal tile design)

**Preferred MPN (new HCal-tile workstation):** `LT3482EUD#TRPBF`  
**JLCPCB / LCSC:** **C515895** (tape/reel)  
**Alternate package:** `LT3482EUD#PBF` **C117167** (tube)

## Role

Generate adjustable cathode bias for **Hamamatsu S12572-33-015P** on
**decommissioned sPHENIX Inner HCal tile assemblies**:

- Vbr ≈ 65 ± 10 V  
- Operating point ≈ **Vbr + 3–4 V** → **~68–75 V** quiet rail  
- Load: dual-end WLS fiber → plastic coupler → single MPPC per tile (µA-class)

This replaces the legacy **MAX1932** recommendation for new designs. MAX1932
remains documented for firmware/heritage continuity only.

## Why LT3482 (better than MAX1932)

| | MAX1932 | **LT3482 (preferred)** |
|--|---------|------------------------|
| Purpose | Digitally set APD bias | **APD boost + high-side current monitor** |
| Vout | ~40–90 V class | **up to 90 V** |
| JLC/LCSC | C2650346 ETC+T (stock variable) | **C515895** TR, expand library |
| Control | SPI byte | Analog FB; **DAC into FB or soft-start for trim** |
| Monitor | Digital set only | **Built-in APD current sense** (fault / dark current) |
| New design | Legacy | **Recommended** |

Datasheet: Analog Devices LT3482 — fixed-frequency current-mode boost, APD current
monitoring, to 90 V output.

## Electrical baseline (target)

| Parameter | Value |
|-----------|--------|
| Vin | 5–12 V from system rail (protected; not raw USB-C 20 V without intermediate) |
| Vout (quiet) | **~70 V** nominal (trim ~65–80 V for Vbr bin + OV) |
| Load current | < 1 mA typical per SiPM (+ dark); design for few mA headroom |
| Filter | Multi-stage RC/LC after boost for AFE quietness |
| HV_MON | Resistive divider to ADC (e.g. 70 V → ~1.5–2 V) |
| OVP | Clamp / comparator near **~85–90 V** |
| Caps | **100 V** ceramic/electrolytic on HV nodes |

DAC trim (from station DAC80508/DAC60508 bank): inject into FB network so
firmware can set OV and compensate temperature (dVbr/dT).

## Design cautions

- **Extended** part — use JLCPCB **Standard** PCBA, not Basic-only.  
- Re-check live stock of **C515895** before freeze; reserve if low.  
- Layout: boost switch node and diode loop **far** from OPA858 summing nodes.  
- Creepage/clearance for ~70–90 V on FR-4 (low energy, but not 30 V rules).  
- Input clamp on AFE: **not** BAV99 (BV=30). Use higher-BV low-C clamps for
  70 V-class cathode fault scenarios.  
- Do **not** put HV on U.FL shells; hybrid panel connector only.

## Relation to TPS61170

| Path | Controller | Detector |
|------|------------|----------|
| **HCal tile assemblies (this design)** | **LT3482 C515895** | Hamamatsu S12572-33-015P |
| Legacy Muon3 MicroFC studies | TPS61170 C15163 | MicroFC-30035 (~30 V) |

The HCal-tile workstation freezes on LT3482 + S12572. TPS61170 remains in the
tree for MicroFC reference only.

## Simulation

- Behavioral HV model: `sim/circuit/hv_lt3482.cir`  
- AFE with S12572: `sim/circuit/afe_hamamatsu_s12572.cir`  
- Compatibility write-up: `sim/circuit/HAMAMATSU_SIPM_COMPATIBILITY.md`

## Alternates (if C515895 unavailable)

1. `LT3482EUD#PBF` **C117167**  
2. `LT8361` **C3188138** / **C673758** — general 100 V switch boost (more design work)  
3. `MAX1932ETC+T` **C2650346** — heritage SPI APD controller only

## References

- Analog Devices LT3482 datasheet  
- Aidala et al., IEEE TNS 65 (2018) — sPHENIX HCal SiPM bias practice  
- Project SiPM notes: `../sipm_hamamatsu_s12572/`
