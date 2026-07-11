# Component selection and alternatives

Catalog review date: 2026-07-11. Stock changes continuously; “preferred” means technically preferred and assembly-supported when checked, not permanently guaranteed.

## Power input and distribution

### USB-C PD sink — CH224K, C970725

Preferred because it is inexpensive, publicly stocked, supports fixed 5/9/12/15/20 V PD contracts and is available in an exposed-pad package that JLCPCB assembles. Muon3 requests 12 V so the Peltier bridges have useful headroom while logic rails are generated efficiently.

Alternatives:

- TPS25730DREFR, C22438973: stronger documentation/ecosystem and stocked, but more expensive and substantially more complex.
- Plain USB-C 5 V sink resistors: useful fallback for electronics-only operation, but cannot provide the intended Peltier power and must disable cooling in firmware.

CH224K does not replace input protection. The final sheet needs a fuse/eFuse, TVS, reverse-current control and bulk capacitance selected for the negotiated power level.

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

### DACs

The design requires at least nine static analog outputs: eight comparator thresholds plus one HV trim. DAC60508 provides eight channels and a second small DAC can provide HV trim and spare controls. It is preferred functionally due to internal reference options and prior project history, but its public JLC stock was not confirmed. MCP4728 is a lower-resolution, broadly sourced quad alternative; three devices cover twelve outputs but require address planning. Final selection is blocked until live stock and reference accuracy are verified.

## Digital, cellular and timing

### nRF9151-LACA-R7 — C22397843

Preferred and assembly-supported. It integrates LTE-M/NB-IoT, GNSS and the application MCU, removing the obsolete carrier headers and external LC76G placeholder. It requires Standard PCBA and X-ray. Reserve stock before production. Follow Nordic's reference design for every supply, RF, SIM and antenna component; do not improvise the LGA fanout.

Both a nano-SIM holder and eSIM footprint are planned. Populate one subscriber identity by default. Onomondo/Telekom nuSIM is a provisioning choice and does not eliminate the physical-SIM option.

### FPGA — ICE40UP5K-SG48I, C2678152

Retained for deterministic coincidence and timestamp logic. It is publicly stocked and JLCPCB assembles its QFN. VCC and VCCPLL are 1.2 V; VCCIO is 3.3 V. The old 3.3 V PLL connection is prohibited.

### Configuration flash — W25Q128JVSIQ

Retained because the part is assembly-supported, widely replaceable and has ample capacity. Multiple catalog records exist, so the final uploaded BOM must select the currently stocked genuine Winbond entry and verify the 208-mil SOIC footprint.

### Timing

Use an exact 25 MHz TCXO only after specifying frequency stability over the full outdoor temperature range, phase noise, startup time and enable behavior. GNSS PPS connects to both nRF9151 and FPGA. A footprint-only “25 MHz oscillator” is not an acceptable BOM line.

## Thermal control

### DRV8873HPWPR — C2150604, one per channel

Preferred because it is an integrated bidirectional H-bridge with SPI diagnostics, current regulation/sensing, thermal protection and adequate peak-current headroom. It was publicly stocked but at relatively low quantity, so reserve it or qualify the alternate before layout freeze.

Alternatives:

- DRV8876PWPR: lower cost and similar motor/Peltier use, but its exact live stock and diagnostic differences must be verified.
- Discrete MOSFET H-bridge: improves sourcing flexibility but greatly increases gate-drive, shoot-through, current-sense and protection design burden.

Each channel requires a local fuse/current limit, bulk ceramic capacitance, filtered current readback and a hardware overtemperature shutdown independent of firmware. The power budget is negotiated: cooling is reduced or disabled unless a suitable PD contract is present.

## Sensors and connectors

BME280 (`C92489`) is retained for atmospheric pressure, humidity and board temperature. Four separate NTC inputs are required—one per SiPM/Peltier assembly. MPPC panel connectors must carry bias, signal return, NTC and Peltier conductors with touch-safe polarization. The legacy scheme that put SiPM HV on the exposed U.FL shell is prohibited. U.FL may still be used for signal-only coax or the LTE/GNSS antenna connections with the shell at ground.

## Sourcing rules

1. Prefer basic or high-stock extended parts for passives and commodity protection.
2. Use exact manufacturer parts for RF, analog, power and safety-critical positions.
3. Keep one electrically qualified alternate for every extended part below the production reserve threshold.
4. Never substitute by package/value alone.
5. Re-run simulation, ERC and DRC when a substitute changes pinout, parasitics, limits or compensation.
