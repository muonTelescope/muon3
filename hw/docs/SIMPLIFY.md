# Fewer parts, easier to assemble, cheaper

Where the money and the parts are today (`bun tools/bom_cost.ts 100`, JLC prices at 100 boards; `bun run cost` for the
whole order):

- Board parts **$16.76**, PCB $2.88, JLC assembly $1.36 → **$21.00 ex-works per board, $31.11 landed in the US** (100
  boards, importer GSU), $97.81 landed per board for the two Berlin prototypes.
- 46 BOM lines, 124 placed parts (plus 22 bare test pads), **18 of the lines are JLC "extended"** parts: $3 loading fee
  each per order.

| Line | Per board | Share of parts |
|---|---|---|
| BME280 | $4.46 | 27 % |
| ESP32-S3-WROOM-1U-N16R8 | $4.10 | 24 % |
| MCP4728 × 2 | $3.06 | 18 % |
| OPA356 × 4 | $1.83 | 11 % |
| LMV7219 × 4 | $0.99 | 6 % |
| U.FL × 4, SC7A20H, STEMMA QT, AMS1117, MC34063, TLV75733 | $1.13 | 7 % |
| the other 35 lines, mostly 0402/0805 passives | $1.19 | 7 % |

Four parts are 80 % of the parts cost, so that is where the savings are. In order of saving per board:

| # | Change | Saves per board | Parts removed | Risk |
|---|---|---|---|---|
| 1 | **BME280 → SPA06-003** (Goertek pressure + temperature, same 2 × 2.5 mm LGA-8, I2C, $0.51 at 100, 5 900 in stock). Humidity is not used: pressure corrects the muon rate, temperature only feeds the bias. | **$3.95** | 0 | New driver; less field history than the BME280. LPS22HB ($1.96) is a middle option |
| 2 | **Drop the second MCP4728.** VREF becomes a fixed divider from 3V3A (2 resistors + the existing 100 nF), and HV_TRIM comes from an ESP32 PWM pin through two 10 k / 1 µF poles (the firmware closes the loop on HV_MON anyway, so the trim's absolute accuracy does not matter). With only one DAC left there is one I2C bus, which also removes two pull-ups and two GPIOs. | **$1.53** | −1 IC, −2 pull-ups, +2 R, +2 C (HV_TRIM), +2 R (VREF) | The PWM trim was the weak point of the first bias design (26–70 V); redo the ngspice run with a two-pole RC into the 68 k feed before committing |
| 3 | **ESP32-S3-WROOM-1U-N4** instead of N16R8 (or N8: −$0.22). 4 MB flash holds firmware + OTA; PSRAM only matters for buffering days of time stamps offline. | $0.55 | 0 | No PSRAM: batch to flash or upload more often |
| 4 | **Drop the SC7A20H tilt sensor** and its capacitor. The station is bolted in a stack. | $0.21 | −1 IC, −1 C | Loses knock/tilt detection |
| 5 | **Two extended parts to basic ones:** BSS123 → 2N7002 (already on the board for HV_EN, same SOT-23 pinout; the MC34063 drives 5 V at the gate), LL4148 → 1N4148W (SOD-123, 100 V). | $0.06 ($6 per order) | −2 lines | 1N4148W's reverse recovery is fine at 33 kHz; check the SOD-123 footprint against the LC clamp's spacing |
| | **Total** | **≈ $6.3** | −3 ICs, ≈ −3 parts net | Parts $16.76 → ≈ $10.5; ex-works $21 → ≈ $14.7; landed $31 → ≈ $22 |

Smaller ones, mostly about part count: drop the four 100 Ω in the VREF branches (the per-channel 100 nF stays), share
the four 4.7 k I2C pull-ups when there is one bus, and use one 1 µF value in place of the three capacitor sizes on
3V3A.

Not worth it:

- **2-layer board** (saves about $1.50): the solid ground plane under 5.8 mV / p.e. amplifiers and the identical cells
  is worth more than that.
- **Removing the analog LDO** (TLV75733, $0.14): the Wi-Fi's 350 mA bursts would ride on the TIA supply.
- **A cheaper comparator** or op-amp: the 7 ns comparator and the 200 MHz op-amp set the 5.8 mV / p.e. and the timing.
- **The display in every station** (OLED + cable about $5, plus the pod): fit it on the factory test jig and on a few
  stations. The plate carries the two inserts for the pod, so it can be added later.

## Assembly

The board itself is already easy: one side, no through-hole parts, no hand soldering, all parts in stock at JLC, and
the four channels are copies of one cell. What is left is mechanical:

- **Replace the 14 printed spacers by four pieces of Ø 12 mm aluminium (or brass) tube** cut to length, or by M6 hex
  standoffs. Printed 87.6 mm tubes warp; a tube from a hardware store is straighter and cheaper than the filament.
- **Snap the clips on, don't thread them.** The corner clips could open sideways (a C shape that snaps over the rod),
  so a tile can be added or removed without taking the stack apart.
- **Make the coax a standard part.** Four U.FL to U.FL micro-coax cables of one length (300 mm) need no soldering and
  no cutting; cut ones to length only for a fixed tile shape.
- **Print the bar once.** For a fixed tile shape (all four tiles of a station are the same shape), print the plate in one
  piece if the bed allows it (widest 235 mm); the arms and splices exist for smaller beds and for changing shapes.
- **Test before it is boxed.** `station_test.py board` needs only USB and takes two minutes, so a failed board never
  reaches the mechanical assembly.
