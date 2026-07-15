# Hamamatsu S12572-33-015P — HCal tile SiPM (primary detector)

**Role:** primary photosensor for the **HCal-tile workstation** design that
reads out **decommissioned sPHENIX Inner HCal tile assemblies**.

**Part:** Hamamatsu **S12572-33-015P** (MPPC)  
**Not** the Muon3 loop-panel MicroFC-30035 (kept only as a reference path).

## Detector facts (sPHENIX HCal)

| Parameter | Value |
|-----------|--------|
| Active area | 3×3 mm² |
| Pixel pitch | 15 μm (~40 000 pixels) |
| PDE (sim / design average) | ~0.25 at WLS green |
| Vbr | ~65 ± 10 V |
| Operating point | Vbr + ~3–4 V → **~68–75 V** |
| Gain (sPHENIX use) | ~2.3×10⁵ |
| QPE | ~37 fC |
| Coupling | Dual fiber ends + **~0.75 mm air gap** in plastic coupler |

Reference: Aidala et al., IEEE TNS 65 (2018); phyxch/sPHENIX_HCal tile GDMLs.

## Station electrical path (frozen for this design)

```
Decommissioned Inner HCal tile (EJ-200 + dual WLS)
  → hybrid panel connector (signal + bias + NTC…)
  → OPA858 TIA (Rf retuned for ~37 fC/p.e.)
  → dual TLV3601 thresholds → iCE40
  → LT3482 boost (C515895) → ~70 V cathode bias
```

| Block | Preferred | JLCPCB/LCSC |
|-------|-----------|-------------|
| SiPM | **S12572-33-015P** | Off-board (on tile) |
| HV boost | **LT3482EUD#TRPBF** | **C515895** |
| HV alt | LT3482EUD#PBF / LT8361 / MAX1932ETC+T | C117167 / C3188138 / C2650346 |
| TIA | OPA858IDSGR | C970232 |
| Clamp | Higher-BV low-C (not BAV99 BV=30) | TBD freeze |

See:

- `../hv_lt3482/README.md`  
- `sim/circuit/HAMAMATSU_SIPM_COMPATIBILITY.md`  
- `sim/circuit/afe_hamamatsu_s12572.cir`  
- `sim/circuit/hv_lt3482.cir`  
- Geant4: `hcal_tile` (PDE 0.25, air gap, effective yield)

## Mechanical / assembly notes

- Design assumes **existing decommissioned tiles** with fiber already glued and
  SiPM coupler geometry as built for sPHENIX.  
- Station provides bias, TIA, dual threshold, telemetry, optional TEC — not a
  new tile fabrication line.  
- Do not place HV on U.FL; use the hybrid locking panel connector only.

## MicroFC-30035

Still documented under `../sipm_microfc_30035/` for the original Muon3 loop-panel
concept and TPS61170 path. **This HCal-tile board is not MicroFC-primary.**
