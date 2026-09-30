# Muon3: a networked cosmic-ray muon station

**In plain English:** muons from cosmic-ray showers pass through us all the time. A plastic scintillator tile gives off a
tiny flash when one crosses it. A silicon photomultiplier (SiPM) turns that flash into a current pulse, and a small board
counts pulses that arrive in several stacked tiles at once. Muon3 is the next-generation station for the Georgia State
University [gLOWCOST](https://cosmic.gsu.edu/) network: cheap, identical detectors in classrooms and labs that log how the
muon rate follows air pressure, temperature and space weather.

A station is four decommissioned **sPHENIX inner-HCal tiles** (Hamamatsu S12572-33-015P SiPMs) stacked **100 mm apart** in a
printed ABS frame, read by **one 96 × 64 mm, 4-layer, USB-powered board** that JLC assembles on one side. The board stands
vertically behind the SiPM edge, in a printed case, with its USB-C port on the side; a small OLED pod beside it shows the
live rates and the self-test result.

| | |
|---|---|
| ![The station, from behind](hw/docs/assembly/tile01_iso_back.png) | ![Electronics, exploded](hw/docs/assembly/tile01_explode_elec.png) |

- **Identical channels.** Channel 0 is placed and routed once; cells 1–3 are exact copies at a 20 mm pitch (copper identical
  to 2 µm, checked on every build).
- **The SiPM bias never leaves the case.** Each tile's micro-coax plugs into a U.FL jack inside the case.
- **External antenna.** An ESP32-S3-WROOM-1U-N16R8 sends its Wi-Fi/BLE through a U.FL pigtail to a flat antenna on the lid.
- **Fits every tile.** All 12 inner-HCal tile shapes, from the 121 mm wide nearly-rectangular tile 01 to the 403 mm
  parallelogram tile 12, get a frame generated from their outline ([assembly guide](hw/docs/ASSEMBLY.md)).

![All 12 tile shapes, same scale](hw/docs/assembly/shapes_top.png)

```text
 tile ─ micro-coax ─► U.FL in the case (shell = bias via 47 kΩ) ─► OPA356 TIA (33 kΩ ‖ 2.7 pF) ─► LMV7219 ─► HIT_n ─► ESP32-S3
   ×4 (identical cells)           ▲                               ▲ VREF (DAC B·A)             ▲ VTH_n (DAC A)      PCNT + MCPWM
             MC34063 boost → 10 k / 1 µF RC ─ HV (53–83 V) ◄─ HV_TRIM (DAC B·B) ◄──────────────────────────── HV_EN
                         └──────────── HV_MON (÷ 27.7) ────────────────────────────────────────────────────► ADC
 INJ (GPIO) ─ 10 k/1.1 k ─ 1 pF into each input: 0.33 pC = 9 p.e. self-test
 BME280 (slotted thermal island, ≥ 20 mm from any input) · SC7A20H tilt · STEMMA QT (display pod) · USB-C 5 V → AMS1117 3V3 + TLV75733 3V3A
```

## Numbers (all simulated; see `hw/sim/` and `sim/geant4/`)

| | Value | From |
|---|---|---|
| **Light: photoelectrons per muon**, tile 01 | **19.5** (σ 11); **90 %** of muons pass a 5 p.e. threshold | Geant4, 400 muons |
| Pulses: 1 p.e. / mean muon | **5.8 mV / 116 mV**, time over threshold ≈ 330 ns; threshold 5 p.e. = 29 mV | ngspice |
| Bias range | **52.9–83.0 V** (TRIM 2.048 → 0 V); ≈ 4 V while HV_EN is low; settles in 60–90 ms | ngspice |
| Switching ripple at the TIA output | **0.04 mV pk-pk (0.007 p.e.)**, with capacitor ESL, resistor shunt C and 1.5 nH shared ground | ngspice, 5 ns steps |
| Injection self-test | 109 mV with no tile, 55 mV with a tile | ngspice |
| BME280 above room air | **+5.4 K** (low-power firmware), +9.2 K (Wi-Fi always on); mid-board would read +13 K | 2D thermal model |
| Wi-Fi at the TIA inputs (+20 dBm accepted, external antenna, cables included) | **1.5–5.2 mV peak**, which rectifies to ≪ 0.01 p.e.; metal cans do not reduce it | openEMS |
| Cost at 100 boards (importer: GSU) | **$21.00 ex-works, $31.11 landed per board** ($16.76 parts); ≈ $22 landed with the changes in [`SIMPLIFY.md`](hw/docs/SIMPLIFY.md) | `bun run cost` |

![Bias supply](hw/docs/sim_hv.png)

## Build one

1. **Board:** `cd hw && bun run build`, then upload `out/muon3-gerbers.zip` with `out/bom.csv` and `out/cpl.csv` to JLC:
   4 layers, 1.6 mm, top-side assembly only.
2. **Frame, case and pod:** `freecadcmd hw/case/case.py`, then `TILE=<1-12> freecadcmd hw/case/assembly.py`. Print in ABS
   (0.2 mm layers, 4 perimeters, 30 % infill). All joints are **M3 socket-head screws into heat-set inserts**; the tiles
   sit in four corner clips on M6 rods. The steps, bill of materials and section views are in
   [`hw/docs/ASSEMBLY.md`](hw/docs/ASSEMBLY.md).
3. **Test:** `python hw/tools/station_test.py board` (2 minutes, USB only), then `… tile --ch N` per tile. The guide, with
   simulated scope screens and the display mock-ups, is [`hw/docs/TESTING.md`](hw/docs/TESTING.md).

The board-as-code pipeline, the parts library and every simulation are described in [`hw/README.md`](hw/README.md).

## Design review

### This pass

- **Footprints at any angle, tapered traces.** Small parts (up to six pads) may sit at any multiple of 15° when that
  shortens their nets by 10 %: 13 of 156 parts ended up rotated (the comparators at 45°, bypass capacitors at 30°), and their
  traces leave straight instead of dog-legging. Every track that leaves a pad starts as wide as the pad's narrow side (up to
  0.45 mm) and narrows to the net width over 0.4–1.0 mm, in six steps that follow corners and arcs and are kept only where
  the wider copper still clears its neighbours (119 tapered steps; the KiCad design-rule check still shows 0 errors, and all
  four channel cells are still identical).
- **External antenna, a cheaper-to-tune radio.** The WROOM-1U-N16R8 has no PCB antenna, so the keep-out that cut a notch in
  the ground plane is gone and the antenna sits outside the case, on the lid.
- **Modular mounting.** The plate is a universal center bar plus per-shape arms and splices; the case and the display pod each
  bolt to it with four and two M3 socket-head screws; nothing is glued.
- **The Geant4 tile model now transports light, and the answer is 19.5 p.e. per muon, not 58.** The "58" had never come
  from transport (see below). It took seven fixes: mirrored fiber pieces, overlapping spectra, a SiPM with no refractive
  index, a reflector that also blocked the fibers, sharp bends and chord kinks, the connector pocket, and the coupler.
  ![Geant4 debugging](figures/hcal_geant4_debug.png)
  *The paths of guided photons that reach the SiPM (left), the loss funnel (middle) and where every photon ends (right).
  More in [`sim/geant4/README.md`](sim/geant4/README.md).*
- **The fiber paths in the source files are wrong for tiles 02–12.** They are the same bounding-box serpentine for every
  tile, which runs outside the slanted scintillator (tile 12's legs stick out 100 mm). The assembly rebuilds a valid path
  for each shape (four legs, semicircles of 28.4 mm, 8 mm to the edge). Check it against GSU's drawings.
- **One question for GSU.** The source CAD has both fiber ends 43 mm apart and one SiPM between them. The default model
  follows the published description (each end faces a SiPM window across a 0.75 mm air gap). If the real coupler is a mixing
  cavity instead, the yield is 0.3 p.e. per muon and nothing would work, so it is not one. **Ask how both ends reach the SiPM.**

### Fewer parts, cheaper

Four parts make 80 % of the $16.76 parts cost (BME280 $4.46, ESP32 $4.10, two DACs $3.06, four op-amps $1.83). Replacing the
BME280 by an SPA06-003 (same package, pressure + temperature, $0.51), dropping the second DAC, using an N4 module, dropping
the tilt sensor and two extended parts saves about **$6.3 per board (landed $31 → $22)** and removes three ICs. The table,
the risks and the mechanical simplifications are in [`hw/docs/SIMPLIFY.md`](hw/docs/SIMPLIFY.md).

### Earlier in Rev C

- **The bias reaches the tiles.** The old PWM trim spanned 26–70 V; now MCP4728 → 1 k / 100 nF → 68 k into FB gives 52.9–83.0 V
  with a 2N7002 holding the boost off until HV_EN. The LC filter that rang at 2 V is an RC, and the peak current is 136 mA.
- **1 p.e. is 5.8 mV**, not 9.5 mV; the 5 V rail was routed at signal width (now 0.5 mm).
- **U.FL jacks inside the case** replaced the edge SMAs whose shells carried the bias.
- **Temperature sensor.** The BME280 hangs on a slotted island on the cool edge (no plane copper, four necked traces) in its own
  vented chamber, and still reads +5.4 K above room: the 0.3–0.6 W inside the box warms everything soldered to the board. The
  design therefore treats it as case temperature and takes SiPM gain from the dark-count staircase. For true tile temperature,
  plug a BME280 or TMP117 into the STEMMA QT port and tape it to the tiles.

![Thermal model](hw/docs/thermal.png)

**EMI.** The openEMS model has the board, the case, the ESP32 can (with its corner notch for the U.FL jack), the external
inverted-L antenna on the lid, each tile's coax shield leaving through the case wall, and the four input paths. With +20 dBm
accepted the four TIA inputs pick up 1.5, 4.6, 5.2 and 3.9 mV peak at 2.44 GHz. Metal cans over the amplifiers move the
numbers by −10 % to +100 % (channel 0 doubles, the others barely change: the pickup comes in on the input path, which a can
with a cable notch cannot enclose) and a printed ABS cavity changes nothing, so there are no cans. A few mV of 2.4 GHz at a
CMOS op-amp input rectifies to microvolts.

![EMI](hw/docs/sim_emi.png)

### Open questions and risks

- **The coupler** (above), and **the closed fiber loop**: the Geant4 model loses the photons that travel the far way round the
  loop, so the real yield is higher, by up to about 1.7× for the trapped light.
- **The U.FL voltage margin** (83 V DC against a 60 V AC rms rating, 200 V AC withstand). Formal sign-off is still needed,
  although the bias no longer reaches an outside surface.
- **Wi-Fi range** with the external antenna and the brass inserts is unmeasured; the test has an RSSI step (≥ −65 dBm at 2 m).
- **USB power banks** often switch off below 50–100 mA; the station draws 40–120 mA.
- **The MC34063 reference is ±2 %**, about ±2 V on HV until the factory test stores each board's HV(TRIM) line.
- **Via-in-pad**: the GND fan-out drops vias inside large pads; order filled and capped vias or check JLC's terms.
- **Stale July material.** `Muon3_Simulation_Studies.tex` (the paper) and `sim/reports/` still describe the July architecture
  and the old Geant4 numbers; their figures were kept so it still builds, but it needs a rewrite before it is quoted.

## Repository

| Path | What |
|---|---|
| [`hw/`](hw/README.md) | Board as code (TypeScript → Gerbers), parts library, case and assembly (FreeCAD), simulations, test tools; [assembly](hw/docs/ASSEMBLY.md), [testing](hw/docs/TESTING.md), [cost and simplification](hw/docs/SIMPLIFY.md) |
| [`sim/`](sim/README.md) | Geant4 tile model and the remaining detector-physics studies |
| `cad/` | sPHENIX inner-HCal tile STEP assemblies (all 12 shapes), Blender scenes |
| `figures/` | Plots and renders used in the paper and here |
| `tools/memguard.sh` | Runs heavy jobs under a memory cap. The 8 GB development Mac crashed when builds and simulations ran in parallel |
| `reference_documentation/` | Archived `muonTelescope` repositories, publications, earlier reviews |

## License

See [LICENSE](LICENSE). Third-party datasheets and 3D models belong to their manufacturers. They are fetched on demand
(`cd hw && bun run parts`), not redistributed.
