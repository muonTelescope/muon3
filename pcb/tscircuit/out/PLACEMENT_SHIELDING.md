# HCal-tile PCB placement & shielding (tscircuit)

**Board:** 160 × 120 mm · 4-layer JLCPCB Standard PCBA target  
**Tool:** tscircuit (`@tscircuit/core`) placement sketch  
**Detectors:** decommissioned sPHENIX Inner HCal tiles · Hamamatsu **S12572-33-015P**  
**HV:** **LT3482** (C515895) ~70 V  

Generated: `2026-07-20`

## Zone map (optimal placement)

| Zone | Center (mm) | Size (mm) | Shielding / notes |
|------|-------------|-----------|-------------------|
| **RF** — RF / nRF9151 | (-65, 35) | 28×42 | RF shield can optional; antenna keepout 15 mm |
| **DIGITAL** — DIGITAL
iCE40+RP2040 | (-32, 20) | 36×55 | — |
| **AFE** — AFE CH0–CH3
OPA858+TLV3601 | (18, 15) | 55×70 | AFE shield fence / can over TIA banks |
| **HV** — HV LT3482
~70 V S12572 | (58, 30) | 28×40 | HV keepout; no pour under boost SW node |
| **POWER** — POWER / USB-PD | (-45, -40) | 55×32 | — |
| **TEC** — TEC DRV8873×4 | (40, -40) | 60×32 | Switching zone; short loops; far from AFE |

### Placement principles (from project notes)

1. **RF at board edge** — nRF9151 + U.FL LTE/GNSS with **≥15 mm antenna keepout** (openEMS / Nordic).
2. **AFE mid-board, connector edge** — four OPA858 banks face panel connectors; short SiPM/bias path.
3. **TEC + USB-PD opposite AFE** — switching loops ≥25 mm from TIA summing nodes (`DESIGN_RULES.md`).
4. **HV island** — LT3482 boost isolated; SW-node keepout; 100 V creepage; no pour under switch.
5. **Continuous ground** — placement zones only; **do not split GND plane** (return-path control).
6. **No copper pour** under TIA virtual-ground nodes (6×6 mm keepouts CH0–CH3).

## Keepouts encoded in tscircuit

| Keepout | Purpose |
|---------|---------|
| Circle r=15 mm @ U.FL LTE | Antenna RF keepout |
| Rect 6×6 mm ×4 @ TIA | No-pour summing node |
| Rect 12×10 mm @ LT3482 SW | HV switch-node keepout |

TIA keepout centers (mm): CH0(-2,35), CH1(12,35), CH2(26,35), CH3(40,35)

## Shielding recommendations

| Region | Recommendation |
|--------|----------------|
| AFE bank | **Shield can or stitched GND fence** over OPA858+comparators (note box on PCB); stitch vias ≤1 mm pitch on fence |
| RF | Optional shield over nRF9151; mandatory copper keepout for antennas |
| HV | Plastic/Kapton barrier or fence if enclosure nearby; never U.FL for bias |
| TEC / PD | No shield required; physical separation + local ground stitching around H-bridges |
| Cable entry | Hybrid connectors along AFE edge; shields to chassis/GND at entry only |

## Signal / power routing priorities (for later autoroute)

| Net class | Width / rules | Path |
|-----------|---------------|------|
| SiPM anode (AFE in) | short, guarded, no vias if possible | J_PANEL → TIA |
| HV cathode | 100 V spacing, thick for IR only if multi-mA | LT3482 filter → J_PANEL bias |
| CMP → FPGA | 50 Ω class microstrip (openEMS HS trace) | AFE → iCE40 |
| TEC power | wide pours, away from AFE | DRV8873 → J_PANEL |
| RF | 50 Ω coplanar to U.FL | nRF9151 only |

## How to regenerate

```bash
cd pcb/tscircuit
bun install
bun run render_placement.ts
```

Outputs:
- `out/hcal_placement.circuit.json`
- `out/hcal_placement_pcb.svg`
- `figures/tscircuit/hcal_placement_pcb.svg`

## Relation to KiCad

This is a **placement / shielding plan**, not a full schematic dump. Port zone
coordinates into `muon3.kicad_pcb` before dense routing. Full netlist remains
in hierarchical KiCad sheets (`afe`, `power_usb_pd`, `digital_radio`, `thermal`).
