# CP30238 TEC/Peltier module (selected 2026-07-11)

Preferred MPN: `CP30238` (Same Sky, formerly CUI Devices)

Current role: one thermoelectric cooler per SiPM cold block, four per station.
Off-board part: it mounts in the panel thermal stack and is wired through the
hybrid panel connector. It is not JLCPCB-assembled and does not appear on the
CPL, only on the system BOM.

## Key specifications (datasheet rev 1.04, 09/12/2024)

| Parameter | Value |
| --- | --- |
| Size | 20 x 20 x 3.8 mm |
| Vmax | 8.6 V |
| Imax | 3.0 A |
| Qmax (Th = 27 degC) | 15.0 W |
| Qmax (Th = 50 degC) | 16.7 W |
| dTmax | 66 degC (27 degC hot side), 72 degC (50 degC) |
| Internal resistance | 2.07-2.53 ohm (2.3 ohm typ) |
| Leads | 22 AWG, 100 +/- 5 mm, red +, black - |
| Sealing | RTV silicone perimeter seal |
| Compression rating | 98 N/cm2 |

## Why selected

- 3 A Imax matches the DRV8873 current-regulated H-bridge operating window and
  keeps 50 cm hybrid-cable currents and voltage drop modest; a 6 A-class
  module (CP60233) would push cable and connector sizing for no thermal need.
- 8.6 V Vmax leaves clean PWM headroom below the 12 V PD rail with an LC
  reconstruction filter, without needing a 20 V contract.
- 20 x 20 mm matches a small SiPM cold block; the SiPM die and carrier are a
  milliwatt-scale load, so capacity is spent on parasitic leakage, not signal.
- RTV-sealed perimeter suits a dew-point-limited cold cavity.
- Traceable manufacturer datasheet with full performance curves, stocked at
  Digi-Key (102-1667-ND) and Mouser; not an anonymous TEC1-127xx commodity.

## Operating point and power budget

Target is dark-rate reduction and gain stabilization at 15-25 degC below the
hot side, not maximum cold.

| Drive current | TEC voltage (approx.) | Electrical power | Usable dT with ~1-2 W leak |
| --- | --- | --- | --- |
| 1.2 A | ~3.4 V | ~4 W | ~20-25 degC |
| 1.5 A | ~4.0 V | ~6 W | ~25-30 degC |
| 1.8 A | ~5.2 V | ~9.5 W | ~30-35 degC |
| 2.4 A | ~6.9 V | ~16.5 W | ~40 degC |

Contract-aware policy:

- 5 V USB-C fallback: TECs and fans off; science acquisition still valid.
- 12 V / 3 A (36 W): all four channels at roughly 1.5 A gives ~24 W of TEC
  drive plus fans and system load; adequate for the 15-25 degC target.
- 20 V / 5 A (100 W): full 2.4 A per channel if ever needed; requires the
  power-tree input ratings (TPS61170 Vin max 18 V, buck inputs) to be
  re-verified before enabling a 20 V contract.
- Firmware caps per-channel current from the negotiated contract; DRV8873
  ITRIP is set at or below 2.5 A as the hardware ceiling, under the 3.0 A
  module limit.

## Thermal stack per channel

- Cold side: machined aluminum cold block, ~20 x 20 mm TEC face, carrying the
  SiPM carrier and cold-side 10k NTC; thermal interface material both faces;
  compression mount within the module's 98 N/cm2 rating.
- Hot side: >= 40 x 40 x 20 mm finned heatsink with hot-side 10k NTC.
- Fan: 40 mm 12 V ball-bearing fan with tach output (Delta AFB0412HHB tach
  variant or Sunon MF40202VX class; confirm the exact tach-equipped suffix at
  the distributor before ordering). Driven from the main PCB through the
  hybrid cable; tach returned for interlock.
- Insulated, RTV/conformal-sealed cold cavity; dew-point interlock stays at
  least 3 degC above calculated dew point unless the cavity is sealed and dry.

## Alternates

- `CP30138` (15 x 15 mm, 3.8 V, 3 A, 6.5 W): if the cold block shrinks and
  per-channel power must drop; lower voltage worsens cable IR share.
- `CP60233` (20 x 20 mm, 8.6 V, 6 A, 27.9 W): same footprint with more
  capacity headroom, but oversized for the DRV8873 ITRIP window and cable.
- Generic `TES1-127xx` 30 x 30 mm modules: cheaper, but unsealed, poorly
  documented, and mechanically oversized for the cold block.

## Gates before ordering

- Confirm live Digi-Key/Mouser stock and price at order time.
- Measure real cold-cavity parasitic load on the one-channel thermal coupon
  and re-fit the operating-point table.
- Verify hybrid cable and connector contacts at 3 A continuous with margin.

Downloaded: `CP30.pdf`
