# Muon Telescope Next-Generation PCB Review

Date: 2026-07-11

> Requirements update: the production baseline is now MicroFC-30035 with 200 x 200 x 10 mm
> loop-fiber panels, directly integrated nRF9151-LACA cellular control, USB-C PD power, dual-threshold ToT plus
> per-channel baseline DACs, safe separated SiPM interconnects, and four independently controlled
> TEC/Peltier channels. See `NEXT_GENERATION_REQUIREMENTS.md` for the controlling specification.

## Scope and confidence

This review covers all 28 `muonTelescope` repositories, their first-party tracked files, README/documentation sources, condensed Git histories, the 2017 compiled technical manual, the 2026 chat/decision record, the RP2350 reference firmware archive, and the unpacked next-generation KiCad/simulation package in `nextgen_review/`. Vendor libraries and binary CAD models were inventoried and sampled where relevant; they were not treated as project decisions. The public gLOWCOST and Muon Telescope sites were also reviewed.

The review is design-level, not a fabrication sign-off. No KiCad or ngspice executable is installed locally. The supplied validation claims were therefore audited through their inputs, generated files, schematics, board structure, models, and current manufacturer documentation. The board has placement and zones but no routed track segments.

## Executive conclusion

The scientific/system concept is viable, and the broad architecture is sensible: a deterministic FPGA timing plane plus a cellular MCU/control plane is a good fit for a distributed detector network. The DC-coupled TIA concept, programmable thresholds, HV telemetry, GNSS PPS, exact-subset counters, ToT histograms, shadow-window accidentals, and remote calibration are all valuable.

The current Rev A package is not electrically viable or fabrication-ready. Two schematic errors alone are release blockers:

1. The OPA858 is supplied from 3.3 V while its inputs are biased at 2.40 V. TI specifies an input common-mode ceiling 1.4 V below the positive supply, or about 1.9 V at 3.3 V. The proposed operating point is out of specification, and the behavioral SPICE model does not model this limitation.
2. The iCE40UP5K `VCCPLL` supply is connected to 3.3 V. Lattice specifies 1.14-1.26 V recommended and 1.42 V absolute maximum. This can damage the FPGA.

The PCB contains 111 footprints, 31 stitching vias, nine zones, and zero routed segments. Existing DRC statements establish placement clearance, not a buildable or signal-integrity-validated board.

## Project history and decisions

### 2015-2017 modular generation

- The detector used roughly 145 x 145 x 10 mm EJ-200 tiles, a looped 1 mm WLS fiber, reflective/light-tight wrapping, and Hamamatsu S13360-2050VE SiPMs.
- The sensor board placed the SiPM, OPA846 preamplifier, 100 kOhm NTC, and optical test LED together. Git history records oscillation fixes, impedance matching, ground vias, sensor changes, and multiple fabricated revisions.
- Bias was per-channel using MAX1932 daughterboards, high-resolution voltage/temperature readback, closed-loop temperature correction, and independent monitoring. A batch of 24 HV boards was built.
- A Raspberry Pi-side stack handled GPIO coincidences, I2C control, environmental/GPS sensors, MySQL storage, REST APIs, and a web display. This software is useful historical evidence but is now technically obsolete (WiringPi, old Node/Bower/Polymer, old Docker/MySQL assumptions, embedded example credentials).

### 2019-2025 integrated interface generation

- `mppcInterface` moved to KiCad, combined MAX1932 bias, DAC control, an iCE40, Raspberry Pi headers, and an eight-channel analog design.
- The latest gateware is experimental, not production logic: it uses signal-derived clocks, 8-bit counters, combinational coincidences, unsynchronized asynchronous inputs, partial channel implementation, and debug UART behavior. It must not be reused as the next-generation timing core.
- The repository history documents useful practical lessons: negative-rail/inverter changes, ground-plane fixes, added decoupling, test points, I2C pin swaps, and repeated routing/fabrication iterations.

### 2026 redesign decisions

- Four channels, nominal 3 p.e. threshold; single-p.e. operation retained only for calibration.
- iCE40UP5K for deterministic edge/ToT/coincidence capture; nRF9151 for housekeeping and LTE-M/NB-IoT.
- DC-coupled anode-readout TIA using OPA858, 2 kOhm feedback and 2.2 pF compensation; TLV3601 comparator.
- Provisional switch from Hamamatsu S13360-2050VE to onsemi MicroFC-30035 to reduce HV and temperature coefficient.
- TPS61170 boost with DAC trim/readback, per-channel RC filtering, BME280 plus local NTCs, external GNSS PPS and TCXO.
- Exact-subset counters, ToT distributions, shadow-window accidentals, muon-lifetime mode, livetime/deadtime, and charge injection.
- One continuous ground system with placement-based partitioning, no-pour regions at summing nodes, and boost quarantine.

These are reasonable objectives, but several are recorded as decisions without corresponding implemented circuitry or RTL.

## Release blockers

### B1 - OPA858 common-mode violation

The schematic powers every OPA858 from 3.3 V and sets `VBOT = 2.40 V`. The current TI OPA858 data sheet specifies the upper input common-mode limit as 1.4 V below the positive rail. The provided macromodel models gain, poles, slew, and approximate output clamps but omits input common-mode behavior, shutdown behavior, bias current, power, supply sensitivity, and realistic overload states. Consequently, its gain/ToT results do not validate the chosen DC operating point.

Resolve by either:

- powering the OPA858 from a clean 5 V analog rail while preserving a 2.4 V baseline;
- lowering VBOT and thresholds to a valid 3.3 V operating point, then rechecking output swing, clamp behavior, DAC range, SiPM bias, and linear range; or
- selecting a truly rail-to-rail-input TIA-compatible amplifier and redoing stability/noise/overload analysis with an official model and bench prototype.

### B2 - iCE40 VCCPLL overvoltage

`gen_sch.py` groups `VCCPLL` with the 3.3 V I/O supplies. Lattice requires VCCPLL at the 1.2 V core level and recommends an RC noise filter between VCC and VCCPLL. Fix the symbol-to-rail mapping, add the required filter/decoupling, and audit every power pin against the current package table.

`VPP_2V5 = 3.3 V` is acceptable for Master SPI operation within the documented 2.30-3.46 V range; it is not the same rail as VCCPLL.

### B3 - Board is not routed

There are no track segments. No claims can yet be made about:

- TIA summing-node parasitics or the assumed 2.2 pF compensation;
- comparator-to-FPGA crosstalk;
- return-current continuity through actual routing/vias;
- boost hot-loop area and magnetic coupling;
- power-distribution impedance, cellular burst droop, or ground bounce;
- creepage/clearance after routing;
- thermal-pad via implementation;
- connector escape and mechanical accessibility.

### B4 - nRF9151 integration must replace generic carrier headers

The baseline is now direct integration of the nRF9151-LACA SiP. J7/J8 are generic headers and
must be replaced with the complete Nordic-reference RF/power/SIM/debug implementation. Supply
integrity, antenna matching and keep-out, physical SIM/eSIM protection, certification scope,
reset/debug access, and the approved reference BOM must be frozen before layout.

### B5 - No production RTL or nRF9151 firmware exists

The committed feature set is a specification only. The old FPGA RTL is unsafe as a starting implementation, and the RP2350 archive is a reference protocol prototype with acknowledged FIFO/drop and clustering concerns. A register map, clock-domain strategy, synchronizer policy, counter atomicity scheme, SPI protocol, reset behavior, overflow behavior, and verification suite are still required.

## High-priority electrical issues

### Power architecture

- AMS1117-3.3 cannot regulate from a LiPo/VSYS range stated as 3.5-5 V; its dropout eliminates regulation through much of a single-cell discharge. A solar/LiPo product needs a defined charger/protection/power-path design and probably buck-boost or a carefully budgeted low-dropout path.
- The nRF9151 requires at least 3.0 V for RF performance and 3.2 V is recommended. LTE current pulses must be supported locally without disturbing the TIA/DAC/FPGA rails.
- Input protection is absent: no fuse/current limiter, reverse-polarity protection, surge/ESD clamp, UVLO strategy, or connector standard is defined.
- The XC6206 1.2 V regulator lacks a shown input capacitor and needs a verified stability/output-capacitor implementation and transient budget for FPGA configuration/current steps.
- iCE40 decoupling is effectively absent. Add per-pin/bank capacitors, bulk capacitance, VCCPLL filtering, and configuration power-sequencing review.
- Analog and digital 3.3 V share a plane. A single ground is correct, but separate filtered/regulator branches for sensitive analog power and noisy RF/digital power should be considered without splitting ground.

### HV generation and safety

- TPS61170 is limited to 38 V output and is only suitable for the low-voltage SiPM option. It cannot be a BOM variant for the roughly 58 V Hamamatsu implementation without a different topology.
- With R11/R12/R13 present, the actual ideal setpoint is approximately `37.7 V - 2.7*HV_TRIM`, not the annotated 34.4 V divider result. Startup DAC state and failure behavior must be explicitly analyzed.
- `EN_HV` benefits from the TPS61170 internal pulldown, but the complete safe-start sequence still needs definition: MCU absent, FPGA unconfigured, DAC reset/midscale, cable disconnected, ADC fault, and firmware crash.
- HV_MON is suitable near 32 V but rises above 3.3 V near the Hamamatsu bias. Divider, ADC input network, settling, leakage error, clamp current, and fault overvoltage must be redesigned per selected carrier ADC.
- 0402 100 kOhm channel resistors and the 0402 1 MOhm divider resistor need verified continuous working-voltage and pulse ratings. Larger packages or series stacks are preferable at 30-60 V.
- 50 V capacitors have inadequate margin for a 58 V build. The proposed 2.2 uF/50 V C0G-or-film part in a 1206 footprint is not a realistic generic placeholder; an actual stocked component and its bias/temperature behavior must be selected.
- A touchable U.FL shield carrying 30-58 V creates hot-plug, contamination, ESD, service, and user-contact concerns. It may remain a deliberate architecture, but needs a connector rating review, discharge time, current limiting, labels/keying, and a field-service procedure.

### Analog front end

- The OPA858 model is a parameterized behavioral approximation, not the TI transistor-level/encrypted model. It is useful for topology intuition, but its numerical 0 dB peaking, overload recovery, noise, and ToT claims should be treated as preliminary.
- The quoted noise calculation uses a flat broadband noise-density approximation and omits 1/f noise, DAC/reference noise, supply noise, comparator kickback, PCB leakage/parasitics, SiPM excess noise/crosstalk/afterpulsing, and ambient-light current.
- One 100 nF + 1 uF pair is described as serving both the OPA858 and comparator. At multi-GHz GBW, each IC needs its own datasheet-compliant local decoupling and extremely short return path. TI's current OPA858 examples use 0.1 uF plus 6.8 uF supply bypassing.
- The BAV99 rail clamps can inject SiPM/HV transient charge into 3.3 V and back-power an unpowered board. Model power sequencing and use a defined low-capacitance protection strategy.
- The common VBOT saves DAC channels but makes a shared-noise/shared-fault node. Preserve individual RC isolation, add test access, and decide whether per-channel baseline trim is needed for offset/calibration yield.
- A 3 p.e. threshold is a sensible starting hypothesis, not yet a field-validated optimum. It must be established from measured dark-rate and muon-efficiency curves across temperature, device spread, optical yield, and ambient leakage.

### Digital, timing, and calibration

- Async comparator inputs require an explicit capture architecture; ordinary two-flop synchronization can miss narrow pulses. Use asynchronous set/capture or oversampling designed and formally/simulation verified for minimum pulse width, metastability, and multi-channel skew.
- Exact-subset semantics need a precise event-clustering definition when pulses overlap only partially or straddle windows. Define leading-edge vs interval overlap semantics, tie-breaking, holdoff, retrigger, and counter saturation.
- ToT with 10 ns bins is useful for discrimination/gain tracking but is not a muon energy spectrometer. Validate its stability against threshold drift, saturation, afterpulsing, fiber position, and temperature.
- The charge-injection network is not implemented. It is essential for a remote fleet and should be added per channel with controlled amplitude, low parasitic capacitance, isolation, and a calibration traceability plan.
- Only two NTC inputs are implemented for four SiPM channels. Either add four channels or explicitly choose paired/shared sensing based on measured thermal gradients.
- The three LED paths have no LEDs; the current schematic connects 3.3 V through 100 Ohm directly to FPGA RGB pins. Either add actual LEDs with a verified current scheme or mark the resistors DNP/remove them.
- Spare FPGA pins are marked no-connect in the schematic, so the promise to route them to test pads cannot be fulfilled without changing the schematic.
- Add SWD/JTAG/debug access for the nRF carrier, FPGA programming/recovery access, SPI/I2C/UART test pads, rail/HV test points, and a factory test fixture plan.

## Mechanical, optical, and scientific viability

- The legacy hardware proves that the panel/fiber/SiPM concept is physically buildable, but the documentation disagrees on light yield. The website/manual says roughly 30-50 photons per event, while the electronics redesign assumes roughly 30 detected photoelectrons and a 20-100 p.e. range. This must be resolved with measured single-p.e.-calibrated distributions on representative finished panels.
- The public site describes both 145 mm legacy panels and later 200 mm designs. Geometry, layer spacing, number of paddles, overlap, orientation, and acceptance are not frozen.
- gLOWCOST's network objectives require pressure correction, temperature stability, absolute/relative detector calibration, station metadata, timing quality flags, livetime, remote health diagnostics, secure updates, and reproducible manufacturing.
- A BME280 inside an enclosure may measure PCB self-heating rather than ambient air. Its placement, vent/membrane, solar shielding, and response time need an environmental design.
- For global outdoor deployment, define enclosure IP rating, condensation strategy, operating temperature, UV exposure, cable strain relief, lightning/ESD environment, antenna radome/ground plane, and service lifetime.
- GNSS PPS is useful for inter-station shower work. Atmospheric muon-rate monitoring itself usually needs stable rates and environmental corrections more than 10 ns timestamps. The scientific priorities should determine whether always-on GNSS power is justified.

## Software and fleet issues

- The 2016-2019 Node/WiringPi/Bower/MySQL stack is historical only. It has obsolete dependencies, example credentials, weak input/query handling, and no modern security/update model.
- The next generation needs authenticated telemetry, encrypted OTA update with rollback, per-device identity, monotonic schema/versioning, local buffering through outages, deduplication, clock-quality flags, configuration audit history, and remote safe-mode/recovery.
- LTE-M/NB-IoT availability, roaming, SIM/eSIM lifecycle, data plan, APN provisioning, and fallback behavior must be validated for every deployment region.
- Define raw-vs-aggregated data retention. For scientific reproducibility, reports should include firmware/RTL versions, configuration hash, thresholds, HV, temperature, pressure, livetime, deadtime, overflow/drop counters, PPS quality, reset reason, and calibration state.

## Prioritized redesign questions

### Must answer before schematic redesign

1. Which SiPM is the production baseline: MicroFC-30035 or S13360-2050VE? What measured p.e. distribution and dark-rate curve exists for the finished panel at the intended overvoltage and temperature range?
2. What is the frozen detector geometry: tile size/thickness, number of paddles, layer spacing, fiber topology, channel mapping, and desired angular acceptance?
3. Is the primary measurement long-term atmospheric/space-weather rate, educational counting, local muon lifetime, or inter-station air-shower coincidence? Rank these; they imply different timing, calibration, power, and data needs.
4. What is the average and worst-case power budget in watts, required autonomy, panel/battery size, minimum winter irradiance, and operating temperature?
5. Which exact nRF9151 carrier/module will be used, with pin map, dimensions, antenna, certifications, SIM/eSIM, supply requirements, and peak-current profile?
6. Can the analog rail become a clean 5 V rail so the OPA858 can operate at VBOT=2.4 V, or must the entire front end remain on 3.3 V?
7. Is HV on the exposed U.FL shield an immutable requirement? If yes, what connector voltage rating, touch/hot-plug policy, discharge time, and field-service constraints are acceptable?
8. Will the PCB include the solar charger, battery protection, fuel gauge, and power-path converter, or interface to a separately qualified power module?

### Must answer before layout freeze

9. What enclosure, mounting-hole, connector-edge, antenna keep-out, cable direction, and PCB size constraints are fixed?
10. Are all four per-SiPM NTCs required? Where are the sensors physically located and how are their two-wire connections carried alongside the SiPM coax?
11. What minimum/maximum comparator pulse widths and event rates have been measured, including afterpulses and large saturation events?
12. What coincidence semantics are scientifically required for overlapping pulses, and what window/holdoff ranges must be supported?
13. Is dual-threshold ToT worth the extra four comparators, or should the spare DAC channels be reserved for per-channel baseline/trim and calibration?
14. What factory/field calibration hardware is required: electrical injection, optical LED injection, threshold scans, per-channel HV readback, and temperature chamber characterization?
15. What failure state is required for loss of MCU, DAC, ADC, FPGA configuration, GNSS, or network? In every case, should HV default off?
16. What fabrication/assembly target is binding: JLCPCB standard assembly only, hand-fitted SiPM/HV parts, four-layer impedance stack, conformal coating, and expected annual volume?

### Must answer before fleet deployment

17. Which countries/operators must be supported, and is LTE-M, NB-IoT, NTN, Wi-Fi, Ethernet, or local storage the required fallback?
18. What timestamp accuracy is scientifically necessary, and what is the permitted GNSS duty cycle/holdover error?
19. What calibration transfer standard makes counts comparable between stations and across replacement panels/SiPMs?
20. What data schema, reporting cadence, local retention, OTA security, device identity, and backend ownership model will replace the legacy stack?
21. What environmental qualification is required: temperature/humidity cycling, condensation, ESD, EFT/surge, radiated immunity/emissions, ingress protection, UV, vibration, and burn-in?
22. What are the quantitative acceptance criteria for muon efficiency, accidental rate, channel crosstalk, gain drift, timing skew, power, and uptime?

## Recommended next work order

1. Freeze science requirements, detector geometry, SiPM, carrier, and power architecture.
2. Correct OPA858 supply/baseline and iCE40 VCCPLL immediately; replace all provisional power/HV components with verified parts.
3. Build a one-channel analog test coupon with the actual SiPM/cable, selectable Cf, charge injection, comparator, and production stackup. Measure gain, stability, dark-rate threshold curve, crosstalk, ToT, overload recovery, temperature drift, and boost/RF susceptibility.
4. Write the FPGA/nRF interface specification and build verified RTL with a synthetic-pulse testbench before relying on a PCB.
5. Complete safe power/HV sequencing, carrier integration, four NTCs, calibration injection, test/debug access, and telemetry.
6. Route the board in the documented order, then run KiCad 10 ERC/DRC, netlist assertions, impedance/return-path inspection, power-integrity review, and independent schematic/layout peer review.
7. Produce prototype and EVT/DVT plans with explicit pass/fail criteria before committing to a fleet build.

## Key external specifications checked

- TI OPA858 current data sheet: https://www.ti.com/lit/ds/symlink/opa858.pdf
- TI TLV3601 data sheet: https://www.ti.com/lit/ds/symlink/tlv3601.pdf
- TI TPS61170 data sheet: https://www.ti.com/lit/ds/symlink/tps61170.pdf
- Lattice iCE40 UltraPlus data sheet: https://www.latticesemi.com/-/media/LatticeSemi/Documents/DataSheets/iCE/FPGA-DS-02008-1-9-iCE40-UltraPlus-Family-Data-Sheet.ashx?document_id=51968
- Nordic nRF9151 product page/specification: https://www.nordicsemi.com/Products/nRF9151
- Quectel LC76G hardware design: https://www.quectel.com/content/uploads/2023/05/Quectel_LC76G_Series_Hardware_Design_V1.3.pdf
- gLOWCOST project: https://cosmic.gsu.edu/glowcost/
- Muon Telescope project: https://muontelescope.com/
