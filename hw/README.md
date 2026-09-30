# Muon3 station board: board as code, straight to Gerbers

A 96 × 64 mm, 4-layer, USB-powered board (Rev C) for the GSU gLOWCOST / Muon3 telescope, assembled by JLC on one
side, in a printed ABS case. It reads four sPHENIX inner-HCal tiles (Hamamatsu S12572-33-015P) over micro-coax on
U.FL jacks inside the case. The four channel cells are identical copies.

TypeScript does the whole job: circuit, placement, routing, copper smoothing, planes, silkscreen, Gerbers, drill,
BOM and CPL. KiCad serves only as an **independent DRC oracle** and 3D renderer.

| | |
|---|---|
| ![3D render](docs/render_3d.png) | ![Routed copper](docs/routed.png) |

*Left: the board (external-antenna module bottom right, U.FL jacks along the top, identical channel cells). Right: the routed
copper, with tapered pad exits and parts at 15° steps where that shortens the nets.*

```bash
cd hw
bun run build        # netlist → place → route → smooth → planes → silk → Gerbers/drill/BOM/CPL (~5 s)
bun run drc          # kicad-cli DRC on the exported board: expect 0 errors, 0 unconnected
bun run cost         # BOM + JLC fees + freight/duty (Berlin prototypes, GSU/US batch)
bun run parts        # (re)fetch footprints, pins, datasheets, STEP/OBJ for every LCSC part
freecadcmd case/case.py                       # case STEP/STL from out/board.json
python tools/station_test.py board            # automated factory test over USB (docs/TESTING.md)
```

Heavy jobs (the board build, FreeCAD, ngspice, openEMS, Geant4, Blender) go through
`../tools/memguard.sh -l <MB> -- cmd`, one at a time. The 8 GB development Mac crashed apps when they ran in
parallel.

## Board

| | |
|---|---|
| Outline | 96 × 64 mm, 3 mm corner radius, 4 × M3 holes 3.5 mm from the corners |
| Channel cells | 4 × (20 × 22 mm) along the top edge, 20 mm pitch (`floorplan.ts` `CELLS`). Each cell holds a U.FL at x = 18.5 + 20k, y = 3, the 47 k / 100 nF bias feed, the TIA, the comparator and a TIA/GND scope pair. Placement, local copper, GND fan-out and silk are identical (`place.ts`, `autoroute.ts` `routeCells`, `copper.ts`) |
| Edges | USB-C and STEMMA QT on the left; ESP32-S3-WROOM-1U low on the right, its U.FL antenna connector 3.7 mm from the right edge (no antenna keep-out: the antenna is outside the case) |
| Stack-up | JLC 4-layer 1.6 mm: L1 signal + parts, **L2 solid GND**, L3 signal/power, L4 signal |
| Rules | 0.127/0.127 mm signal track/clearance; 0.5 mm for 5 V, 0.4 mm for 3V3, 0.3 mm for 3V3A and HV_SW; HV nets ≥ 0.26 mm to anything (IPC-2221 B2 needs 0.25 mm at 100 V); 0.3/0.5 mm vias |
| Assembly | Top side only; test points are bare pads, excluded from BOM and CPL |
| BME280 island | x 0–8.4, y 25–35.6 mm on the left edge, ≥ 20 mm from any TIA input, cut free by two C-shaped slots. It hangs on a 2.6 × 3.6 mm arm plus two 1 mm FR4 edge bridges. Island and arm have **no plane and no plane vias** (`board.noPlane`); the router necks power traces to 0.127 mm there |
| Probe row | 22 pads at 2.54 mm on the bottom edge: GND 5V 3V3 3V3A VREF VTH0–3 HIT0–3 INJ HV_EN HV_TRIM HV_MON DAC_C DAC_D SDA0 SCL0 GND. Each channel also has a TIA/GND pair for a ground-spring probe |

### Circuit (`src/design.ts`)

| Block | Parts | Notes |
|---|---|---|
| Input × 4 | Hirose U.FL-R-SMT-1(80) (C88374) inside the case; shell = SiPM cathode = HVJ_n fed from HV via 47 kΩ, with 100 nF to GND; centre = anode = SIG_n | The shell is the bias *and* the signal's AC shield. U.FL is rated 60 V AC rms / 200 V AC withstand; the bias tops out at 83 V DC |
| TIA × 4 | OPA356, Rf 33 k ‖ Cf 2.7 p, IN+ = VREF through 100 Ω / 100 nF | [SIM] 5.8 mV per p.e., 116 mV for the 19.5 p.e. mean muon (Geant4) |
| Discriminator × 4 | LMV7219, IN+ = VTH_n through 1 k / 100 nF, 33 Ω series into the ESP32 | Threshold at 5 p.e. is set by calibration |
| Self-test | INJ GPIO → 10 k / 1.1 k → 1 pF into every SIG_n | Each edge injects 0.33 pC = 9 p.e. |
| DACs | MCP4728 A (I2C0) = VTH0–3. MCP4728 B (I2C1) = VREF, HV_TRIM, and DAC_C / DAC_D (spares on the probe row) | Internal 2.048 V reference |
| Bias | MC34063 (2.2 Ω sense → 136 mA peak, 1 nF timing), BSS123, 150 µH, LL4148, 1 µF + 100 nF; **10 k / 1 µF RC post-filter**. Feedback 1.02 M / 20 k; TRIM → 1 k / 100 nF → 68 k into FB. HV_EN: a 2N7002 releases a 10 k / LL4148 clamp that otherwise holds FB high | HV = 1.25 + 1.02 M·(1.25/20 k + (1.25 − V_TRIM)/68 k): **83.0 V at TRIM 0 V, 52.9 V at 2.048 V** [SIM]. ≈ 4 V while HV_EN is low. HV_MON = HV ÷ 27.7 to the ADC |
| MCU | ESP32-S3-WROOM-1U-N16R8 (C3013946): U.FL antenna connector, 16 MB flash, 8 MB octal PSRAM (IO35–37 reserved and never used). The pin-swap step picks the nearest free GPIOs for HIT0–3 (the build log lists them). USB on IO19/20 | PCNT singles, MCPWM capture (time stamp + time over threshold), coincidences in firmware. The external antenna keeps the 2.4 GHz source away from the AFE and out of the shielding of the case |
| Power | USB-C 5 V (5.1 k Rd), USBLC6 ESD → AMS1117-3.3 (digital) + TLV75733 (analog) | No battery |
| Sensors | BME280 (0x76) on the island; SC7A20H tilt (0x19); STEMMA QT (JST-SH) on I2C0 | Add a remote BME280/TMP117 on the QT port to measure the tiles themselves |

## Case (`case/case.py`, FreeCAD)

![Exploded case, board, plate and pod](docs/assembly/tile01_explode_elec.png)

- **Outer size and split.** 102 × 70 × 16.5 mm, split at the board mid-plane.
- **Coax entry.** A 1.8 × 2.4 mm notch in the lid skirt above each U.FL takes a Ø 1.13 or 1.37 mm micro-coax. A
  zip-tie bar on the outside of the base takes the strain off the U.FL plugs. The bias on the U.FL shells stays
  inside the closed case.
- **Fasteners.** Four ISO 4762 M3 × 12 socket-head screws pass through counterbored lid columns and the board's
  corner holes, into M3 × 5.7 heat-set inserts (Ø 4.0 × 6.0 holes) in the base bosses. Each screw engages 5.5 mm.
- **Openings.** A USB-C opening (12.6 × 6.8) and a STEMMA QT opening in the left wall. A pin hole over BOOT and a
  Ø 2 light pipe over the status LED.
- **BME280 chamber.** Ribs above and below the island, stopping 0.15 mm short of the board so they never clamp it.
  Eight 1.6 mm slots through the left wall vent the chamber to room air.
- **Hot side.** Eight 1.6 × 14 mm chimney slots in the floor and lid over the ESP32 and AMS1117.
- **External antenna.** A Ø 3.2 mm hole in the lid over the module's U.FL jack (board x 92.3, y 51.0) passes the
  pigtail to a 36 × 7 × 0.7 mm recess on the lid's outer face, where a flat 2.4 GHz FPC antenna sticks (a shallow groove
  carries the pigtail).
- **Mounting.** Four Ø 3.4 mm holes in the base floor (board x/y 24/8, 72/8, 28/56, 52/56) take M3 × 6 socket-head
  screws into the back plate's heat-set inserts; the heads sit in the gap under the board. The case is a self-contained
  module: the plate, the case and the display pod all attach with M3 socket-head screws into heat-set inserts, so any of
  them can be swapped. The mechanical assembly, the 12 tile shapes and the section views are in
  [`docs/ASSEMBLY.md`](docs/ASSEMBLY.md).

## Simulations (`sim/`)

| File | What | Result |
|---|---|---|
| `hv_rev2.cir` + `hv_rev2.inc`, `run_hv2.sh`, `plot_hv.py` | MC34063 bias, behavioural, 0.1 µs step (coarser steps under-count the 0.3 µs diode pulses) | 52.9 / 68.4 / 83.0 V; < 0.09 mV ripple at the TIA → `docs/sim_hv.png` |
| `hv_old.cir`, `hv_new.cir`, `run_hv.sh` | The old PWM trim vs. the DAC trim, both with the old LC filter | Old: 25.9–70.6 V with a 73 V boot overshoot; this is why the trim was replaced |
| `scope_guide.cir`, `plot_scope.py`, `display_mock.py` | One channel: injection with and without a tile, 1 p.e., the 19.5 p.e. mean muon; mock-ups of the pod's OLED | → `docs/scope_guide.png`, `docs/display_mock.png` |
| `afe_s12572_tia.cir` | Rf/Cf sweep against the p.e. count | Chose 33 k / 2.7 p (old plot: `docs/sim_afe.png`) |
| `hv_ripple.cir` | Ripple with parasitics: capacitor ESL/ESR, resistor shunt C, 1.5 nH shared ground, OPA356 GBW-limited TIA; 6 ms at 5 ns | Switching ripple 230 mV on HV_RAW → 4 mV on the jack shell → **0.04 mV pk-pk at the TIA** (the TIA's gain from shell to output is ≈ 2× at 33 kHz, up to 120× above 1.8 MHz) |
| `thermal.py` | 2D conduction in the board + case air nodes; layouts A (island + chamber), B (island, no chamber), C (mid-board) | BME280 +5.4 K (low-power firmware), +9.2 K (Wi-Fi on), mid-board +13 K → `docs/thermal.png` |
| `emi_openems.py`, `plot_emi.py` | openEMS FDTD, 2.44 GHz: board, case, ESP32 can, external inverted-L antenna on the lid (S11 −3.5 dB at 2.44 GHz; the numbers are scaled to 100 mW *accepted*), U.FL jacks + coax shields leaving the case, 4 input paths; variants none / metal cans / ABS cavity | 1.5 / 4.6 / 5.2 / 3.9 mV peak at +20 dBm; cans do not help (ch0 doubles) → `docs/sim_emi.png` |

The openEMS Python bindings are built from source against Homebrew's CSXCAD/openEMS (VTK 9.7):
`CSXCAD_INSTALL_PATH=/opt/homebrew pip install --no-build-isolation CSXCAD/python openEMS/python`, with setuptools,
cython and h5py installed first.

## Pipeline

| Step | File | Notes |
|---|---|---|
| Parts | `tools/fetch_parts.ts` | LCSC/EasyEDA API → pads, pin names, holes/slots, 3D body, datasheet (validated `%PDF`), STEP + OBJ |
| Passives | `src/passives.ts` | value + package → nearest JLC *basic* part (no loading fee) unless `=value` |
| Circuit | `src/design.ts`, `src/circuit.ts` | Netlist by pin *name*; `c.tp()` adds bare test pads |
| Placement | `src/floorplan.ts`, `src/place.ts` | Edge parts, the island and the probe row are fixed; groups are placed by force + legalisation. Parts of up to six pads may take any multiple of 15° if that shortens their nets by 10 %. The four channel cells are placed once and copied |
| Pin swap | `src/pinswap.ts` | GPIO-matrix nets (HIT_n) go to the nearest free ESP32 pin |
| Routing | `src/router.ts`, `src/autoroute.ts` | 0.1 mm grid A*, 3 routed layers, soft rip-up + PathFinder history. GND is a via fan-out into L2, except on thermal islands, where GND leaves on traces |
| Copper | `src/copper.ts` | Pulls each net taut, fillets every corner with the largest legal arc, and tapers every pad exit from the pad's narrow side (≤ 0.45 mm) to the net width over 0.4–1.0 mm in six steps, kept only where the clearance holds. Channel-0 copper is smoothed only where it is legal in all four cells and is then copied exactly |
| Planes | `src/planes.ts` | L2 GND with antipads; cut-outs for the slots and the thermal island (the external antenna needs no keep-out) |
| Silk | `src/silk.ts`, `src/labels.ts` | Footprint outlines; collision-aware labels (probe row, scope pairs, HV warnings); bottom-side notes |
| Output | `src/gerber.ts`, `src/jlc.ts`, `src/kicad.ts` | Gerber X2 with native arcs, Excellon with G85 slots, BOM/CPL, and a `.kicad_pcb` export for DRC and renders |

## Status (2026-09-30)

- Rev C fully routed: 156 parts. Cells: `6 local nets × 4 cells, 18/18 copies identical`. JS DRC: 0 clearance,
  0 open. **kicad-cli DRC: 0 errors, 0 unconnected.**
- Parts list: [`parts/INDEX.md`](parts/INDEX.md). Test guide: [`docs/TESTING.md`](docs/TESTING.md).
- Footprints: 13 of 156 parts are rotated to multiples of 15°; 119 tapered steps leave the pads; KiCad DRC still 0.
- Assembly of all 12 tile shapes, sections and BOM: [`docs/ASSEMBLY.md`](docs/ASSEMBLY.md). Cost and what to cut:
  [`docs/SIMPLIFY.md`](docs/SIMPLIFY.md). $21.00 ex-works / $31.11 landed per board at 100 boards.
- **Not done:**
  - firmware (ESP-IDF; its USB protocol, including the display, is specified in `tools/station_test.py`);
  - a real JLC quote, and a Wi-Fi range measurement with the external antenna on a prototype;
  - Geant4 for tiles 02–12 (their source fiber paths are invalid; `case/assembly.py` rebuilds them) and the closed fiber loop;
  - GSU's answer on how the coupler brings both fiber ends to the SiPM.
