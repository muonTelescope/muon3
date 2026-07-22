# Muon3 controller — layout & placement design

160 × 120 mm, **4-layer** JLCPCB Standard. Origin = board center, +y up,
top view. The machine-readable floorplan (zone coordinates, channel anchors,
trace-width classes, mounting holes) lives in [layout.ts](layout.ts) and is
rendered onto the board by [floorplan.tsx](floorplan.tsx). Placement is driven
by the frozen requirements in
[../pcb/SCHEMATIC_FREEZE_CHECK.md](../pcb/SCHEMATIC_FREEZE_CHECK.md) and the
constraints in [../pcb/DESIGN_RULES.md](../pcb/DESIGN_RULES.md).

## Guiding principle: quiet top / noisy bottom

The board splits into a **quiet upper half** (RF, AFE, HV, digital) over a
**noisy / high-current lower half** (USB-C PD + rails, TEC drivers + fans).
The physical split keeps every AFE summing node **≥ 25 mm** from PD/TEC
switching (DESIGN_RULES), while a **continuous L2 ground plane** under the
whole board gives clean return paths — no plane splits, which would break
AFE/RF return currents. Panel connectors sit on the **top edge** so the 50 cm
hybrid cables exit cleanly and each SiPM signal reaches its TIA in the shortest
path.

## 4-layer stackup (1oz outer / 0.5oz inner)

| Layer | Use |
| --- | --- |
| **L1 (top)** | components + AFE/RF signal; short high-speed runs |
| **L2 (inner)** | **continuous ground plane** (no splits) — return path + shield |
| **L3 (inner)** | power pours: 12 V, 5 V_A, 3 V3, 1 V2; slow signal |
| **L4 (bottom)** | components + TEC power, connectors, secondary routing |

Analog return currents and RF references run on L2 directly beneath their L1
signals; TEC/PD high-current pours live on L3/L4 in the lower half, away from
the L1 AFE signals.

## Zones (rationale)

| Zone | Where | Why here |
| --- | --- | --- |
| **RF** nRF9151 + GNSS | left edge, upper | Board edge for the antenna; **Nordic reference geometry** (decision 10) with a 12 mm antenna keepout; far from every switcher (PD/TEC/HV boost) |
| **AFE ×4** (S12572) | top-center, spanning | Quiet analog heart; panel connectors on the top edge (short SiPM path); one shield fence over the TIA banks; isolated from the bottom-half switching |
| **HV** LT3482 ~70 V | right edge, upper | Isolated boost; no pour under the SW node; ≥ 0.6 mm creepage at 70 V; HV bias bus runs along the top to each panel connector |
| **DIGITAL** iCE40 + RP2040 + DAC/ADC | center | Between AFE (DAC thresholds up, FPGA capture down) and RF; short SPI/parallel links both ways |
| **POWER** USB-C PD + rails | bottom-left | USB-C receptacle on the bottom edge; CH224K + bucks; switching kept low and left, ≥ 25 mm below AFE |
| **TEC** DRV8873 ×4 + fans | bottom-right | Highest-current + switching zone; short H-bridge loops; TEC/fan power exits toward the panel connectors; farthest from AFE |

### AFE channel tiling

Each channel is a compact ~18 × 40 mm **vertical strip** (see [afe.tsx](afe.tsx)):
panel connector at the top edge → `Rser` + rail clamps → OPA858 TIA (feedback
on the FB pin) → dual TLV3601 comparators → output damping → FPGA header at the
bottom (toward DIGITAL). Four strips tile at a 23 mm pitch across the AFE zone.
The signal flows top→bottom (cable → TIA → comparator → FPGA), so the fast
summing node stays short and the DAC threshold refs enter from the DIGITAL side.

## Power paths & trace widths

Currents from [../sim/python/power_budget.py](../sim/python/power_budget.py) and
the freeze decisions (12 V PD rail; TEC ITRIP ≤ 2.5 A/ch). On a JLCPCB 4-layer
1oz outer / 0.5oz inner board:

| Net class | Width / method | Note |
| --- | --- | --- |
| GND | **plane (L2)** | continuous, no splits |
| 12 V main | **1.5 mm / L3 pour** | ~8–10 A aggregate (4× TEC + fans) |
| 12 V per-TEC | 0.8 mm | ~2.5 A/channel |
| TEC out (to panel) | 0.8 mm | 2.5 A H-bridge output |
| 5 V analog | 0.4 mm, **star** | quiet, one branch per OPA858 |
| 3 V3 | 0.5 mm / L3 pour | logic |
| 1 V2 | 0.4 mm | iCE40 core |
| HV ~70 V | 0.25 mm trace, **≥ 0.6 mm clearance/creepage** | low current, high V |
| AFE signal | 0.20 mm, guarded, short | no pour on the summing node |
| RF | ~0.30 mm 50 Ω, L2 reference | no gaps under the trace |
| I²C/SPI | 0.15 mm (6 mil) | default signal |

Power enters at the bottom-left (USB-C), the 12 V rail runs east along the
bottom to the TEC drivers (bottom-right), and the quiet 5 V_A / 3 V3 / 1 V2 rails
feed north into the AFE/digital zones — high-current and quiet-analog paths never
share a corridor.

## Isolation & keepout rules (rendered on the board)

- AFE ↔ PD/TEC switching **≥ 25 mm** (the top/bottom split enforces it).
- **Continuous GND plane** on L2 — no split planes anywhere.
- **HV**: no copper pour under the LT3482 SW node; ≥ 0.6 mm creepage on the
  ~70 V net; touch-safe at the panel connector.
- **RF**: 12 mm antenna keepout at the left edge; Nordic reference geometry.
- **AFE**: shield-can fence over the TIA banks, 1 mm GND stitch pitch.
- Four **M3 mounting holes** at the corners.

## Status & known limitations

- **Placement done** for AFE ×4 (real parts), power seed, HV anchor, and the
  full zone floorplan. Routing is deferred (`routingDisabled`); RF/AFE/HV are
  hand-routed per DESIGN_RULES, TEC/rails can be autorouted.
- Component **anchors** for DIGITAL (iCE40/RP2040/DAC/ADC) and TEC (DRV8873 ×4)
  are the next placement pass; their zones are reserved and sized.
- **4-layer gerber export**: tscircuit's gerber exporter currently rejects inner
  layers ("Inner layer inner1 only supports copper gerbers"), so `bun run fab`
  skips the gerber zip on this 4-layer board. The **KiCad export**
  (`fab/muon3-board.kicad_pcb`) is the 4-layer fabrication source — open it,
  confirm the stackup, and plot gerbers from KiCad until the exporter is fixed.
- Silkscreen zone labels overlap a few components/edges cosmetically; they are
  fabrication-note/silk only and will be tidied during routing.
