# Component selection and alternatives

Catalog review date: 2026-07-11 (updated with new architecture requirements). Stock changes continuously; “preferred” means technically preferred and assembly-supported when checked, not permanently guaranteed.

## Power input and distribution (updated per new requirements)

### USB-C PD + Battery + Solar — TPS25751-class controller + BQ2579x charger

**New requirement**: onboard battery/solar support **or** full 20 V / 5 A power management is now mandatory.

Preferred solution: **TPS25751** (TI USB Type-C & PD 3.2 controller with integrated managed power paths) paired with a **BQ25792** (or BQ25756) battery charger / power-path IC.

- Supports high-power PD contracts (20 V / 5 A capable).
- Native integration with external TI chargers via I2C.
- True bidirectional power path: USB-C PD sink + battery charge/discharge + solar/DC input support.
- Hardware contract status signals usable for safety interlocks ("sufficient power negotiated").
- Enables onboard Li-ion/LiFePO4 + solar while keeping robust USB-C operation.

Rationale:
- CH224K was a minimal sink-only part. It cannot provide proper power path, battery management, or the 20 V/5 A headroom + solar path now required.
- TPS25751 + BQ family is the direct "TPS25751-class full power-path + charger" reference design requested.
- Allows science operation from battery when no PD source is present, and graceful solar supplementation.

See `parts/power_pd_tps25751/` and `parts/charger_bq25792/`.

Input protection (eFuse/TVS/reverse), bulk caps, and high-current layout for TECs remain mandatory.

### 3.3 V and 1.2 V rails

Synchronous bucks from the post-charger / system rail (now variable 5-20 V bus). 12 V nominal target for TEC headroom when high-power PD or battery is available. 5 V fallback must still boot the electronics safely (with TECs hardware-disabled).

### 3.3 V and 1.2 V rails

Do not reuse AMS1117. A synchronous 12 V-capable buck is required for 3.3 V because cellular transmit bursts and FPGA load make a linear regulator inefficient. The exact buck remains a release-blocking selection until an in-stock part is checked for input rating, transient response, light-load mode, thermal margin and Nordic supply requirements.

XC6206P122MR-G (`C424699`) is available but limited to about 60 mA, so it is only an alternate for a lightly loaded FPGA core. The preferred 1.2 V rail will be a higher-current regulator with at least 200 mA design margin.

### SiPM high voltage — TPS61170DRVR, C15163

Preferred because the exact WSON part is publicly stocked and supports the approximately 30 V MicroFC-30035 operating point. The old `C77205` mapping was wrong. Its output rating leaves limited transient margin, so the design must include an OVP path and verify the complete bias range. A higher-voltage controller is the alternate if tests show inadequate margin.

## Analog front end

### TIA — OPA858IDSGR, C970232

Preferred for its low input current/noise, bandwidth and current JLCPCB assembly support. The prior 3.3 V/VBOT implementation is rejected: the new AFE uses a supply and input bias point that remain inside the data-sheet common-mode/output ranges across temperature and tolerances.

Alternatives:

- OPA846IDBVR (`C205997` in the legacy project): easier SOT-23 assembly and known project history, but greater input-current/noise tradeoffs and a different stable-gain requirement.
- OPA356-class amplifier: widely available and lower power, but much lower bandwidth; acceptable only after pulse-shape/coincidence simulation.

### Dual thresholds

Two comparators per channel provide a low physics threshold and a higher shower/noise-discrimination threshold. TLV3601IDBVR remains the performance reference but public stock was not confirmed during the audit, so it cannot be the only production option. Before schematic freeze, qualify a stocked push-pull comparator against propagation delay, dispersion, minimum pulse width, input overdrive, common-mode range and power. The PCB should support one exact qualified footprint, not “any SOT-23-5” substitution.

### DACs — two 8-channel precision (DAC80508 class)

**Requirement**: Use two 8-channel precision DACs.

Preferred: Two **DAC80508** (16-bit, 8-ch, SPI, excellent internal 2.5 V reference 5 ppm/°C).

- Total 16 independent analog outputs.
- Allocation (example):
  - DAC A: 8 comparator thresholds (low + high per channel) + charge/optical injection levels.
  - DAC B: SiPM HV trim, up to 4× TEC current/voltage setpoints, calibration references, spares.
- Higher resolution + better accuracy/tempco than previous DAC60508 approach.
- Internal reference reduces BOM parts and drift.
- JLCPCB has stocked variants (verify current LCSC at layout time).

See `parts/dac_dual_80508/`.

SPI master can be the RP2040 telemetry processor (recommended for real-time updates) or nRF9151. FPGA may assist LDAC timing if needed.

## Digital, cellular and timing

### Primary comms: nRF9151-LACA-R7 — C22397843

Retained as the **primary** radio + application processor.

- LTE-M / NB-IoT + GNSS for remote/long-range telemetry (critical for distributed muon telescope stations).
- Integrates the main app MCU.
- Follow Nordic reference exactly for RF, supplies, SIM, antenna keepout.

### Telemetry subsystem co-processor — RP2040 (preferred)

**Add RP2040** as dedicated telemetry / interface / low-level I/O co-processor.

Why RP2040 (vs. or in addition to nRF54):
- nRF9151 keeps cellular. RP2040 excels at the "telemetry subsystem" role:
  - PIO state machines for precise fan tachometry, custom timing, sensor capture.
  - Dual M0+ cores separate real-time I/O from USB/logging.
  - Native high-speed USB for local desktop tools, data download, and co-processor updates.
  - Extremely cost-effective and available.
- nRF54 (BLE 5.4) would be excellent for **local Bluetooth** phone/field access.
- Current decision: RP2040 is the primary addition for telemetry. Board should allow a small optional nRF54 footprint or module later if Bluetooth proves valuable in deployment.

Interconnect: UART/SPI between nRF9151 and RP2040; direct access to FPGA and sensors where latency matters.

See `parts/telemetry_rp2040/`.

### FPGA — ICE40UP5K-SG48I, C2678152

Retained for deterministic coincidence and timestamp logic. It is publicly stocked and JLCPCB assembles its QFN. VCC and VCCPLL are 1.2 V; VCCIO is 3.3 V. The old 3.3 V PLL connection is prohibited.

### Configuration flash — W25Q128JVSIQ

Retained because the part is assembly-supported, widely replaceable and has ample capacity. Multiple catalog records exist, so the final uploaded BOM must select the currently stocked genuine Winbond entry and verify the 208-mil SOIC footprint.

### Timing

Use an exact 25 MHz TCXO only after specifying frequency stability over the full outdoor temperature range, phase noise, startup time and enable behavior. GNSS PPS connects to both nRF9151 and FPGA. A footprint-only “25 MHz oscillator” is not an acceptable BOM line.

## Thermal control

### TEC module — Same Sky CP30238, one per channel (selected 2026-07-11)

20 x 20 x 3.8 mm, Vmax 8.6 V, Imax 3.0 A, Qmax 15 W, dTmax 66 degC, ~2.3 Ω internal resistance. Off-board part in the panel thermal stack, wired through the hybrid connector; stocked at Digi-Key (102-1667-ND). Operating point roughly 1.2–1.8 A for a 15–25 degC drop; a 12 V/3 A PD contract supports all four channels at the low end, and 5 V fallback runs with cooling off. Thermal stack per channel: aluminum cold block with cold-side NTC, ≥40 x 40 x 20 mm hot-side heatsink with hot-side NTC, and a 40 mm 12 V tach fan. See `parts/tec_cp30238/` for the full selection note and datasheet.

### DRV8873HPWPR — C2150604 (or qualified alternate), one per channel

Retained for H-bridge (JLC assembly).

### Hardware-default-off TEC safety interlock (mandatory)

**Critical new requirement**: The TEC section must default to OFF in **hardware**, not firmware. The following conditions must independently (or in combination) force the Peltier bridges and fans off, regardless of MCU/FPGA state:

- Invalid NTC (open, short, or out-of-range on cold-side or hot-side)
- Hot-side overtemperature
- Insufficient PD contract / inadequate power available (from TPS25751 status or VBUS monitoring)
- Watchdog loss (missing heartbeat from nRF9151, RP2040, or preferably the iCE40 FPGA)
- Overcurrent (per-channel or aggregate)

Implementation approach:
- Analog window comparators on all NTC voltages.
- Dedicated hot-side temperature comparator (or thermal fuse + comparator).
- Power-path / PD "contract good" hardware signal.
- Retriggerable watchdog timer (monostable or dedicated IC) driven by periodic pulse (FPGA recommended for reliability).
- Current sense + comparator per bridge (supplements DRV8873 internal limits).
- Logic (discrete gates, small PLD, or simple MOSFET logic) that ANDs the "all safe" conditions to gate:
  - Main high-side power switch for the TEC 12 V bus, **and/or**
  - Individual DRV8873 EN pins.
- Faults preferably **latching** (overtemp, overcurrent, watchdog) until power cycle or explicit hardware reset.
- Firmware / RP2040 / nRF9151 can only *request* enable after reading all sensors; they cannot bypass the hardware interlock.
- Status of each interlock readable by the processors for diagnostics (via comparators or ADC).

This is now a non-negotiable safety gate. See thermal schematic notes and DESIGN_RULES.md.

Fan tach loss should also contribute to disabling its associated channel.

Power budget is still negotiated, but hardware now enforces the limits.

### Fan drive — one channel per TEC (added 2026-07-11)

Four 12 V fan channels using a JLC-basic low-side N-MOSFET (AO3400A class) with flyback diode and a conditioned tach input each. Fan target is a 40 mm 12 V ball-bearing fan with tach (Delta AFB0412HHB tach variant or Sunon MF40202VX class; confirm the exact tach-equipped suffix before ordering). Tach loss is a thermal interlock: the affected TEC channel defaults off.

## Sensors and connectors

BME280 (`C92489`) is retained for atmospheric pressure, humidity and board temperature, and feeds the dew-point interlock. Decision 2026-07-11: eight separate NTC inputs are required—one cold-side and one hot-side per SiPM/Peltier assembly—plus four fan tach inputs and an enclosure-open switch input. This confirms the need for a multichannel external ADC.

Decision 2026-07-11: each panel uses a single hybrid locking connector carrying shielded SiPM signal, bias, both NTCs, TEC power, and fan power/tach over a 50 cm cable, with touch-safe polarization. The separate-coax-plus-auxiliary scheme is retired. The exact connector family is still to be selected and must support 3 A continuous on the TEC contacts. The legacy scheme that put SiPM HV on the exposed U.FL shell is prohibited. U.FL remains in use for the LTE/GNSS antenna connections with the shell at ground.

## Sourcing rules

1. Prefer basic or high-stock extended parts for passives and commodity protection.
2. Use exact manufacturer parts for RF, analog, power and safety-critical positions.
3. Keep one electrically qualified alternate for every extended part below the production reserve threshold.
4. Never substitute by package/value alone.
5. Re-run simulation, ERC and DRC when a substitute changes pinout, parasitics, limits or compensation.
