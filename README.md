# Muon3: Networked Cosmic-Ray Muon Telescope

**In plain English:** muons from cosmic-ray showers pass through us all the time. A plastic scintillator
tile gives off a tiny flash when one crosses it; a silicon photomultiplier (SiPM) turns that flash into a
current pulse; a small board counts pulses that arrive in several stacked tiles at once. Muon3 is the
next-generation station for the Georgia State University [gLOWCOST](https://cosmic.gsu.edu/) network —
cheap, identical detectors in classrooms and labs around the world that log how the muon rate follows
pressure, temperature and space weather.

![Muon3 station board, 3D](hw/docs/render_3d.png)

## The station board (Rev B, 2026-09-29)

One **100 × 150 mm, 6-layer, fully JLC-assembled board** (all parts on top except the edge SMAs' bottom ground tabs), reading four
**decommissioned sPHENIX inner-HCal tiles** (EJ-200 + Y11 WLS fiber + Hamamatsu **S12572-33-015P**).
It is designed, placed, routed and turned into Gerbers entirely in TypeScript — see [`hw/`](hw/README.md).

```text
HCal tile ── pigtail + SMA plug ──► edge SMA (shell = SiPM bias ≤ 80 V, 47 kΩ limited; centre = anode)
   │                                   │
   │                         OPA356 TIA (33 kΩ ‖ 2.7 pF, baseline = per-channel bias trim)
   │                                   │
   │                         LMV7219 comparator (threshold per channel, MCP4728 DAC)
   │                                   ▼
   │                   iCE40UP5K: time stamps, time-over-threshold, coincidences
   │                                   │ SPI (ESP32 also configures + clocks the FPGA)
   ▼                                   ▼
MAX1932 bias 54–104 V ◄── SPI ── ESP32-S3 (Wi-Fi / BLE / USB)
                                       │
BME280 (pressure · temperature · humidity) · SC7A20H tilt · STEMMA QT (I2C expansion)
USB-C 5 V ─► BQ25890 charger ─► 4 × 18650 in parallel (per-cell fuse + "reversed" LED)
```

| | |
|---|---|
| ![Routed copper](hw/docs/routed.png) | ![Top render](hw/docs/render_top.png) |
| Routed copper, 4 signal layers (L1 red, L3 orange, L4 purple, L6 blue) between two solid GND planes. Traces are pulled taut and every corner is a true arc (G02/G03 in the Gerbers). | Top view. Edge-launch SMAs straddle the top edge (as on gLOWCOST 2v2); ESP32 antenna overhangs the right edge; cells load from the top. |

Status: **fully routed; kicad-cli DRC 0 violations / 0 unconnected; the in-house JS checker agrees.**
Build it with `cd hw && bun run build` (≈10 s). 159 placements, 53 LCSC line items (25 extended).

### What changed, and why (Musk order: fix requirements → delete → simplify → speed up → automate)

GSU's science product is minute/hourly rates from indoor sites that have power and Wi-Fi, at about
$700 per detector. Everything else had to earn its place. Kept and deleted, with reasons, are in
[`hw/README.md`](hw/README.md). In short: the July/September plans (panel-head boards, LVDS harness,
TEC coolers and interlocks, LTE modem, GNSS, USB-PD + 4S battery management, Ethernet, OLED, microSD,
$16 DACs, a second comparator per channel, LoRa) were removed; the board keeps what the tested
[gLOWCOST 2v2](https://github.com/tharinduudu/gLOWCOST-2v2-mppcInterface-) board proved (MAX1932 bias,
edge SMAs with HV on the shell, anode-offset bias trim) and adds USB/Wi-Fi and on-board cells.

**How the tiles connect.** The official sPHENIX inner-HCal tiles have *no connector*: each tile's SiPM daughter
board has a short soldered shielded twisted-pair pigtail, and the temperature sensor sits on the tower
electronics, not the tile ([arXiv:1704.01461](https://arxiv.org/abs/1704.01461); sPHENIX ICD-003,
[PD-2/3 review 2019](https://indico.bnl.gov/event/6145/)). Muon3 terminates each pigtail in an SMA plug
and uses the on-board **BME280** for temperature-compensated bias (S12572: 60 mV/°C).

### Cost (5 boards, estimate — `cd hw && bun run cost`)

| | |
|---|---|
| Parts (JLC/LCSC, basic parts preferred) | ≈ $237 |
| 6-layer PCB 100 × 150 mm | ≈ $120 [estimate — replace with a JLC quote] |
| Assembly (two sides for the SMA tabs, 25 extended-part fees, joints) | ≈ $99 |
| **Ex-works** | **≈ $91 / board** |
| Two orders: 2 → Berlin (19 % VAT) + 3 → GSU (importer of record, 45 % tariff assumed) | ≈ $971 landed |
| …if GSU qualifies for duty-free scientific-instrument entry (HTS 9810.00.60) | US order ≈ $391 instead of $567 |

Shipping all five to Berlin and forwarding is ≈ $50 worse (VAT on every board, second freight leg; the US
tariff follows China origin either way).

## Simulations

**Front end, HCal tile → station** ([`hw/sim/afe_s12572_tia.cir`](hw/sim/afe_s12572_tia.cir), ngspice). S12572-015
delivers only ≈ 37 fC per photoelectron from 320 pF, so the amplifier is a transimpedance stage straight on the
anode: ≈ 9.5 mV/p.e., a 5 p.e. threshold at ≈ 35 mV (≈ 8σ above amplifier + dark-count noise), a mean muon
(58 p.e.) ≈ 380 mV. After-pulse settling stays 3–11 mV from baseline, far from the threshold, so a muon cannot
count twice.

![AFE simulation](hw/docs/sim_afe.png)

**Light yield, sPHENIX inner-HCal tile 01** (Geant4 optical model, `sim/geant4/`, ROOT plots, 200 events):
⟨N<sub>pe</sub>⟩ ≈ 58 at 1.9 MeV deposited — about 10× margin over the 5 p.e. threshold.

| | |
|---|---|
| ![HCal p.e.](figures/hcal_inner_tile_pe.png) | ![HCal yield map](figures/hcal_inner_tile_yield_map.png) |
| ![HCal tile 01](figures/hcal_InnerHCalTile01_EJ200_iso.png) | ![HCal summary](figures/hcal_inner_tile_summary.png) |

More in [`sim/`](sim/README.md) (Geant4 optical transport, ngspice, openEMS, thermal and power models),
[`cad/sphenix_hcal/`](cad/sphenix_hcal/README.md) (tile STEP assemblies) and the paper
[`Muon3_Simulation_Studies.pdf`](Muon3_Simulation_Studies.pdf) (`./build_paper.sh`). Some sim and paper
sections describe the earlier July architecture (nRF9151, OPA858, TEC); the physics results still apply.

```bash
root -l -b -q 'sim/reports/root_hcal_and_geant4.C'     # HCal tile plots
ngspice -b hw/sim/afe_s12572_tia.cir                    # front-end gain sweep
```

## Repository layout

| Path | What |
|---|---|
| [`hw/`](hw/README.md) | **Station board as code**: netlist, placement, router, Gerber writer, DRC, JLC BOM/CPL, cost model, parts library (footprints + datasheets + STEP per LCSC part) |
| `sim/` | Geant4, ngspice, openEMS, Python thermal/power/coincidence models |
| `cad/` | sPHENIX inner-HCal tile STEP assemblies, Blender scenes |
| `figures/` | Plots and renders used here and in the paper |
| `Muon3Vision/` | Vision Pro viewer for the detector geometry |
| `reference_documentation/` | 28 archived `muonTelescope` repos, publications, earlier reviews and requirements |
| `scripts/` | Google Drive sync for large data |

The retired July tscircuit board, the Rev A KiCad project, the nRF firmware and iCE40 gateware were removed
on 2026-09-29; they remain in git history (`git log --all -- pcb board`).

## Open items

1. Real JLC quote (6-layer, epoxy-filled via-in-pad on the QFN/module exposed pads) and GSU's duty treatment.
2. Firmware (ESP-IDF: FPGA configuration, bias/threshold calibration, rates over Wi-Fi/USB) and iCE40 gateware.
3. Bench test of one channel on a real HCal tile before the 5-board order.

## Background

- sPHENIX calorimeter design and beam tests: Aidala et al., IEEE TNS 65 (2018), [arXiv:1704.01461](https://arxiv.org/abs/1704.01461).
- gLOWCOST network: [cosmic.gsu.edu](https://cosmic.gsu.edu/); ICRC 2019/2021 proceedings in `reference_documentation/publications/`.
- Earlier readout generations: `reference_documentation/repositories/mppcInterface`, [gLOWCOST 2v2](https://github.com/tharinduudu/gLOWCOST-2v2-mppcInterface-).

## License

See [LICENSE](LICENSE). Third-party datasheets and models belong to their manufacturers and are fetched,
not redistributed (`cd hw && bun run parts`).
