# DECISIONS.md — Design Decisions & Reasoning
4-Channel SiPM Cosmic-Ray Muon Telescope. ADR-style log. Each entry: decision, alternatives
considered, reasoning, quantitative evidence, verification status, open items.

Status legend: [SIM] verified in ngspice · [NET] verified in exported KiCad netlist ·
[DRC] verified by pcbnew DRC · [DS] verified against datasheet/official source ·
[OPEN] decision or verification still pending.

---

## D1. Operate at 3–10 p.e. threshold, not single-photon
**Decision:** Nominal threshold 3 p.e. (2.326 V, i.e. 74 mV below 2.40 V baseline); keep
DAC reach down to 1–2 p.e. for calibration runs only.
**Alternatives:** 0.5–1 p.e. "single photon" operation (the original framing).
**Reasoning:** S13360-2050VE dark rate at 0.5 p.e. is O(100 kHz)/channel at room temp.
Accidental coincidences R1·R2·2τ ≈ 18 kHz for two 300 kHz channels at 100 ns — 6 orders
above the real muon rate (~1/min/cm²). Also a power win: kHz-not-100kHz event handling.
The single-p.e. staircase remains reachable purely as a gain-calibration observable.
**Evidence:** [SIM] 3 p.e. sits exactly at trigger edge in transient runs; electronics noise
0.06 p.e. rms → threshold is 48 σ from noise, so trigger rate is set by SiPM dark counts
alone. DAC LSB = 0.8 mV = 0.033 p.e.

## D2. Architecture: iCE40UP5K (timing) + nRF9151 (housekeeping + LTE-M); RP2350 dropped
**Decision:** Two-chip split. UP5K fabric: edge capture, coincidence windowing, exact-subset
counters, ToT histograms, holdoff, shadow-window engine, PPS counter latch — all in
BRAM-backed registers read by the nRF9151 over SPI. nRF9151 M33 (Zephyr): I2C (DAC7578,
BME280), boost trim/enable, ADC (HV_MON, NTCs), GNSS NMEA, batching + LTE-M uplink.
**Alternatives:** (a) keep RP2350 (PIO adequate but serial capture, FIFO/queue drop
pathology, tens of mA); (b) FPGA-only with soft core (USB/I2C in fabric painful);
(c) RP2350 + nRF9151-as-AT-modem (named as the fast-track fallback and v1→v2 path).
**Reasoning:** FPGA is strictly better at the 5% (deterministic parallel ns capture, µA–mA);
nRF9151's built-in M33 absorbs the 95% housekeeping the RP did, so nothing is duplicated.
Open-toolchain criterion (original reason for RP over FPGA) is satisfied by
yosys/nextpnr/icestorm.
**Power:** cellular TX bursts 100–300 mA are amortized by PSM + batching (15–60 reports per
uplink → <1 mA average; batching interval is an OTA knob). Flag/pause counting during TX
bursts (~0.1% deadtime) rather than risk RF-coupled fake coincidences. [OPEN] nRF9151 is
carried on headers (J7/J8) to a certified module/carrier — sourcing + exact carrier pin map
to be finalized; RF antenna keep-away from the analog strip.

## D3. Front end: DC-coupled anode-readout TIA (OPA858), replacing BFR93A discrete
**Decision:** Per channel: SiPM anode direct to OPA858 inverting input held at VBOT
(2.40 V virtual ground); cathode at HV_QUIET via 100 k + 100 n. Rf = 2 kΩ 1%,
Cf = 2.2 pF C0G. TIA output → TLV3601 IN+, threshold DAC → IN− ⇒ active-low output
(idle HIGH, event = falling edge), matching existing firmware convention.
**Alternatives considered in order:** BFR93A common-emitter (rejected: 140 pF into kΩ input
= µs pole); common-base BJT (viable: re ≈ 13 Ω @ 2 mA, recommended while power budget was
~1–2 mA/ch; BFP420/640 as modern parts); OPA855/LTC6268 (same class, rejected earlier purely
on power); SiPM ASICs (overkill). User raised ceiling to ~20 mA/ch → TIA chosen.
**Reasoning (TIA wins):** virtual ground makes the 140 pF a one-time compensation problem
(Cf), not a bandwidth killer; gain = Rf → four channels matched to 1% and temperature-flat,
so one DAC-code→p.e. constant serves all channels (prerequisite for threshold-scan
spectroscopy and ToT gain tracking); linear-to-rail with tens-of-ns overload recovery;
**DC coupling deletes the AC-coupling undershoot / rate-dependent-baseline problem
entirely** (dark current µA × 2 k = mV static offset only). OPA858 specifics: FET input
(no current noise into 2 k), decompensated min-gain-7 is safe because HF noise gain
1+Cin/Cf ≈ 66; the FB pin (pin 1) is an internal tie to OUT provided for tight Rf/Cf
routing — feedback connects there. [DS from official KiCad lib]
**Evidence:** [SIM] 24.4 mV/p.e.; f₋₃dB 52.5 MHz with 0.0 dB peaking at Cf = 2.2 pF
(1.0 pF → +3.6 dB peaking/ringing; 4.7 pF → 19 MHz overdamped) — matches hand calc
Cf = √(Cin/(π·Rf·GBW)) = 2.08 pF; linear to ~92 p.e.; 500 p.e. overload recovers ≈140 ns,
no re-trigger; time-walk 6.7 ns over 4→800 p.e.; output noise 1.5 mV rms (en·(1+Cin/Cf)·
√(1.57·f₋₃dB)), Rf Johnson 52 µV negligible. [NET] full feedback loop verified incl. FB pin.
**Fallback documented:** OPA356 (~8 mA): 11.8 mV/p.e., ~10 MHz, Cf = 11 pF, time-walk
19.1 ns — adequate for 50–100 ns windows; NOT pin-compatible → decide before layout freeze.
Macromodel caveat: op-amp/comparator models are datasheet-parameter macros (TI encrypted
models don't run in ngspice); edges good to ±20%, gain/stability/ToT-shape solid.

## D4. Comparator: TLV3601 (TLV3603 optional for pin-set hysteresis)
**Decision:** TLV3601 DBV per channel; 33 Ω series into FPGA pin. Pinout [DS]: 1 OUT, 2 VEE,
3 IN+, 4 IN−, 5 VCC. Internal hysteresis ~3–6 mV — never chatters against 24 mV/p.e.
**Correction made mid-project:** Icc is 4.9 mA typ (datasheet), not the ~1 mA first quoted.
4× ≈ 20 mA. If that matters, LMV7219 (1.1 mA, 7 ns) is the drop-back; kept TLV3601 for
2.5 ns and modern sourcing. [OPEN] revisit at power-budget close-out.

## D5. ToT as the energy observable; peak-detector path dropped
**Decision:** Capture both comparator edges in fabric, 10 ns bins; per-channel coarse ToT
histograms (16–32 bins) in BRAM, shipped with every report. No ADC peak detector.
**Reasoning:** ToT ≈ τ·ln(A/Vth) — logarithmic/compressed. Sufficient for: dark/afterpulse
rejection inside coincidences, gain drift tracking via muon ToT-peak position (a physics
closed loop on top of the thermometric one), corner-clipper tagging. NOT a muon energy
spectrometer — 1 cm scintillator gives Landau dE/dx nearly independent of muon momentum;
no estimator fixes that. Events above analog clip (~92 p.e.) classified "large", not read
as energy (sim showed compression + slight non-monotonicity in deep saturation).
**Evidence:** [SIM] ToT = 14.6·ln(Npe) − 7.5 ns fit over 4–75 p.e., slope ≈ SiPM decay τ.
**Upgrade path:** dual-threshold ToT (second comparator/channel; DAC spare channels exist).

## D6. SiPM choice: schematic drawn for MicroFC-30035; Hamamatsu remains an option [OPEN]
**Decision (provisional):** HV chain drawn for onsemi MicroFC-30035: HV_QUIET ≈ 29.8–32.4 V
(cathode−VBOT = Vbr+Vov; sim used 32.4 V placeholder — signal behavior depends only on
pulse charge). TPS61170 boost fits this directly.
**Reasoning:** Vbr ~24.5 V with few-hundred-mV matching (shared rail viable), 21.5 mV/°C
(≈⅓ the fractional drift), simple cheap boost replaces APD-specific MAX1932, CosmicWatch
heritage. Hamamatsu path preserved: swap boost stage (MAX1932 or higher-ratio), filter and
everything downstream unchanged; all sims used the Hamamatsu 140 pF (conservative — MicroFC
Cterm is smaller, only improves bandwidth). [OPEN] final SiPM selection; HV cap voltage
ratings must follow (≥50 V for MicroFC, ≥100 V margin for Hamamatsu).

## D7. HV bias: TPS61170 + π filter + DAC trim + ADC readback
**Decision:** VSYS → TPS61170 (pins [DS]: 1 FB, 2 COMP, 3 GND, 4 SW, 5 CTRL=EN_HV, 6 VIN
+ pad; external L1 10 µH ≥1.2 A, SS510B 100 V Schottky, COMP 4.7 k + 10 n) → C10 1 µ →
L2 100 µ (CDFER 2 mA part is fine: load is µA) → C11 1 µ → R10 1 k → C12 2.2 µ film/C0G →
HV_QUIET → per-channel 100 k + 100 n at each U.FL. FB divider 270 k/10 k sets ≈34.4 V;
R13 100 k from FB to HV_TRIM (DAC ch or filtered PWM) pulls setpoint down. Readback:
1 M/62 k (÷17.1) → HV_MON → nRF9151 ADC.
**Reasoning:** µA loads make brute-force RC filtering nearly free; setpoint must be
firmware-trimmable for the temperature loop (D8); readback closes the loop and separates
"boost died" from "no muons" remotely. X7R forbidden on the final HV node (DC-bias
capacitance collapse) — film/C0G specified.
**Evidence:** [SIM/analytic] ≥84 dB (R10/C12) + ≥98 dB (per-channel RC) at the 1.2 MHz
switch frequency; residual risk identified as MAGNETIC coupling from the hot loop → handled
by placement (D13), not filtering. [NET] HV_FB/HV_TRIM/HV_MON/EN_HV all verified.

## D8. Two nested gain-stabilization loops
**Decision:** (1) Thermometric: nRF9151 reads BME280 (+ per-SiPM NTCs on ADC), sets
V_bias = Vbr(25°) + tempco·(T−25) + Vov via HV_TRIM, ~1/min. (2) Physics: track the muon
ToT-distribution peak; drift = residual gain error → slow correction / flag.
**Reasoning:** SiPM gain ∝ overvoltage; NTCs on the SiPM carriers track die (not air)
temperature under solar load. The ToT peak is a free, continuous, physics-grounded
calibration that validates the datasheet tempco in situ.

## D9. Timing: LC76G GNSS PPS + TCXO-clocked FPGA, disciplined by arithmetic
**Decision:** LC76G on header J6 (3V3/GND/TX/RX/PPS/EN); PPS → iCE40 pin 20 (G3 global);
TCXO (±0.5–2 ppm, 2520, e.g. 25 MHz) → pin 35 (G0). Fabric latches the free-running counter
on each PPS edge; counter-delta-per-PPS goes in every report (= measured true oscillator
frequency and TCXO health). Timestamps disciplined in nRF9151 software — no PLL gymnastics.
UTC second label from NMEA over nRF9151 UART.
**Reasoning:** enables inter-station extensive-air-shower coincidence (HiSPARC/CREDO model);
PPS ±20–30 ns matches 10 ns bins; nRF9151's own GNSS lacks a hardware-precision PPS.
iCE40 has no crystal driver → oscillator mandatory; TCXO sets holdover quality if GNSS is
duty-cycled (~25 mA tracking is the biggest optional load). [OPEN] TCXO part selection —
footprint drawn as ECS 2520MV 4-pin, VERIFY pinout of the exact part ordered.

## D10. FPGA feature set (RTL scope for Codex)
Committed data-product features, all cheap in fabric: exact-subset coincidence counters
(15 masks, order 3,5,9,6,10,12,7,11,13,14,15 — exact-subset semantics: a 3-fold does NOT
increment its 2-fold subsets), raw singles, configurable window + holdoff (holdoff MUST be
bypassable for lifetime mode), per-channel ToT histograms, **shadow-window accidentals
engine** (clone coincidence engine, one channel delayed few µs → continuous measured fake
rate in every report), **muon-lifetime histogram** (same-channel double pulses 0.5–20 µs,
τ = 2.2 µs exponential), livetime/deadtime counters, PPS counter latch, charge-injection
pulse generator output (via ~1 pF into each preamp input — [OPEN] injection network not yet
in schematic), SPI slave register bank to nRF9151 (pins: SCK 23, COPI 25, CIPO 26, CS 27,
IRQ 28). Config from W25Q128 on hard SPI (SO 14, SCK 15, SS 16, SI 17; CRESET 8, CDONE 7).

## D11. Verified pin map (frozen by schematic, [NET])
iCE40UP5K-SG48: CMP0–3 = 9/10/11/12 (IOB_16a/18a/20a/22b); PPS = 20 (G3); TCXO = 35 (G0);
config flash 14/15/16/17; nRF SPI 23/25/26/27 + IRQ 28; RGB 39/40/41 (open-drain, LED
anodes via 100 Ω to 3V3); spares no-connected, to become test pads. Powers: VCC(5,30)=1V2;
VCCIO_0(33), SPI_VCCIO1(22), VCCIO_2(1), VCCPLL(29) = 3V3; VPP_2V5(24) = 3V3 [OPEN: VERIFY
against current Lattice DS — 2.3–3.6 V believed permitted]. DAC7578: VOUTA–D = THRESH0–3,
VOUTE = VBOT (ONE shared baseline for all four channels — identical by design, frees
channels), VOUTF = HV_TRIM, G/H spare; VREFIN = AVDD = 3V3 (ratiometric, LSB 0.8 mV);
~LDAC = GND, ~CLR = 3V3, ADDR0 = GND [OPEN: VERIFY resulting I2C address]. BME280:
CSB = SDO = 3V3 → I2C addr 0x77. I2C pull-ups 2×4.7 k.

## D12. U.FL SiPM interconnect: shield = HV, center = signal (user requirement)
**Decision:** One BWIPX-1-001E U.FL per channel at the board edge (CDFER, LCSC C5137195).
Center pin = SiPM anode → R2 10 Ω → summing node. Shield = HV_SIPMx = cathode bias.
**Reasoning:** the shield is AC-grounded by C1 100 n within ~6 mm of the connector → it
shields normally at signal frequencies while DC-carrying the bias; bias + signal share one
coax → minimal loop area, no separate bias lead to pick up fields. ~30 V DC on a touchable
shield is SELV; Hamamatsu variant (~58 V) still <60 V DC but flagged.
**Bug found & fixed:** CDFER's U.FL FOOTPRINT has pads 1/2/3 (two shield legs) but their
SYMBOL nets only pad 2 → one shield leg would float. Project symbol carries pin 3 = second
shield leg, netted to HV_SIPMx. [NET] HV_SIPM0 = {C101.1, J2.2, J2.3, R101.2};
SIPM_AN0 = {J2.1, R102.1}.

## D13. PCB grounding / noise architecture (the "no ground loops" answer)
**Decisions baked into muon_telescope.kicad_pcb (108×86 mm, 4-layer
F.Cu | In1 GND | In2 +3V3 | B.Cu GND):**
1. **ONE continuous ground domain — no split planes anywhere.** A plane slot forces return
   currents around it = the classic manufactured ground loop. Partitioning is achieved by
   PLACEMENT distance, not copper surgery.
2. 31 GND stitching vias on a 9 mm grid tie F/In1/B grounds to one RF potential (pours
   can't become patch antennas), auto-excluded from component bboxes and rule areas.
3. Per-channel RULE AREAS (no copper pour, In1+In2+B.Cu) under each summing node
   (Rf/Cf/INA region): protects the 2.2 pF Cf from plane parasitics and the fC-sensitive
   node from leakage. Stitching-via generator skips these.
4. **Boost quarantine:** TPS61170 hot loop bottom-right, >40 mm from the nearest summing
   node; In2 beneath the entire boost region is a priority GND fill — the 3V3 plane is
   denied any area under the switch node, so it can't capacitively pick up SW edges and
   carry them across the board.
5. Channels strip on the LEFT edge, U.FL at the edge, signal grows monotonically
   left→right (U.FL → R2 → clamps → TIA → comparator → 33 Ω → FPGA); comparator outputs
   (3.3 V/1 ns edges, the main self-interference source) route right, away from all INAs,
   over solid In1.
6. HV distribution: star from C12; HV_QUIET runs the bottom/left perimeter to the four R1s
   (DC + filtered → length free). HV netclass 0.5 mm clearance (patterns HV_*, BOOST_SW)
   in .kicad_pro.
7. Routing intentionally left manual, with ordered guidance in README (input paths first
   and shortest, boost hot loop tight before neighbors, supplies last via In2, via farms on
   all thermal pads). [OPEN] snug decoupling caps to supply pins during routing (currently
   ~4 mm).
**Evidence:** [DRC] final report: 0 clearance / 0 courtyard / 0 hole / 0 dangling-via /
0 mask-bridge; remaining entries = unrouted ratsnest (expected) + cosmetic silk.
Earlier DRC iterations caught and fixed: cross-sheet refdes collisions (see D15), header
rot-270 extent collisions, 16 mm channel pitch touching (→17 mm), mounting-hole conflicts.

## D14. File format strategy (KiCad 10 requirement)
**Decision:** Primary deliverable in 20250114 / generator 9.0 grammar — the exact format
KiCad 10.0 ships its own demo projects in (verified by pulling demos + sch_file_versions.h
from the 10.0 source branch; current native version is 20260306, stamped on first save).
Grammar pattern-matched element-by-element against 10.0-tree reference files; every emitted
s-expr token checked against eeschema/schematic.keywords from branch 10.0. A structurally
identical KiCad 7 twin exists because the only locally runnable validator is
kicad-cli 7.0.11 — the twin was netlist-validated and, being generated from identical
structure, transfers that verification to the v10 set. PCB is v7 format (KiCad 10 migrates
on open; official docs guarantee backward compatibility). CDFER footprints are v8-format →
a lossless-for-geometry v8→v7 down-converter (property→fp_text, uuid→tstamp, token
whitelist) produced JLCPCB_v7.pretty; original CDFER lib also bundled for KiCad 10 use.

## D15. Verification methodology (why the netlist step is non-negotiable)
Machine-generated EDA files were validated at four levels: (1) parser level (kicad-cli
plot/netlist for v7; sexpdata + token-vocabulary + keyword-list audit for v10 grammar);
(2) electrical level — programmatic assertions on every critical net in the exported
netlist; (3) DRC level for the board; (4) simulation level for the analog values the
schematic encodes. This process caught three real bugs that would otherwise have shipped:
duplicate refdes across sheets silently merging nets; the CDFER U.FL floating shield pad;
the op-amp macromodel wind-up masquerading as a latch-up. Lesson encoded for future agents:
never trust generated EDA artifacts without netlist-level assertions.

## D16. Consolidated OPEN items / VERIFY-before-order list
- Final SiPM selection (MicroFC-30035 vs S13360-2050VE) → boost stage + HV cap ratings.
- XC6206P122 1.2 V LDO pinout + LCSC ID; placeholder LCSC on 0402 1 µF / 0603 10 µF.
- DAC7578 I2C address for ADDR0=GND; TLV3601/OPA858/TPS61170/DAC7578/iCE40 extended-part
  LCSC IDs (live stock check).
- iCE40 VPP_2V5 fed from 3V3 vs current Lattice datasheet.
- TCXO exact part vs drawn ECS-2520MV footprint/pinout; GNSS LC76G module pin order on J6.
- nRF9151 carrier choice + J7/J8 pin agreement; antenna keep-away.
- Charge-injection network (D10) not yet in schematic.
- TLV3601 20 mA total vs LMV7219 4.4 mA — power close-out decision.
- AMS1117 (linear) → 3.3 V buck swap for the solar build.
- Routing pass; decouplers to pins; thermal-pad via farms; then ERC/DRC in real KiCad 10
  as final authority; JLC fab/BOM/CPL export.

## D17. Suggested next work packages (for Codex)
1. iCE40 RTL: register map + capture/coincidence/ToT/shadow/lifetime/PPS blocks per D10/D11
   (yosys/nextpnr, icebreaker-style constraints from the frozen pin map).
2. nRF9151 Zephyr firmware: SPI register client, I2C drivers (reuse Summary-B protocol
   framing over LTE-M instead of USB CDC), temperature loop, batching/PSM.
3. PCB routing per D13 guidance; then fab outputs.
4. Bench validation plan is in the design report §8 (charge injection 0.27 V ≈ 1 p.e.).
