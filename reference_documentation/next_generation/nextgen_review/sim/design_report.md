# 4-Channel SiPM Muon Telescope — TIA Front-End Design & Simulation Report

Revision: 2026-06-10 · Topology: DC-coupled anode-readout TIA (OPA858) + fast comparator (TLV3601) · Verified in ngspice-42

---

## 1. Architecture summary

Each of the four channels is:

```
HV_QUIET ──R1 100k──┬── CATH (local 100n C0G reservoir, C1)
                    │
                 SiPM D1 (S13360-2050VE, K up / A down)
                    │ anode
                    R2 10Ω ── INA (summing node, BAV99 clamps to 3V3/GND)
                    │
              ┌─────┴──── −IN  U1 OPA858 ────┬── TIA_OUT
              │  Rf 2k ‖ Cf 2.2p feedback    │
   CHx_VBOT ──┴── +IN (2.40 V, DAC4–7)       │
                                             ├── +IN  U2 TLV3601 ── R5 33Ω ── CHx_CMP → iCE40
                              CHx_THRESH ────┴── −IN (2.326 V, DAC0–3)
```

The decisive topology choice is **DC coupling of the SiPM anode to the TIA summing node**. Because the TIA holds its input at the VBOT potential (a virtual ground), the SiPM anode can sit there directly while the cathode carries the full bias. This **eliminates the input AC-coupling capacitor entirely**, and with it the baseline-undershoot and rate-dependent-threshold problems that an AC-coupled chain suffers. The SiPM dark current (sub-µA typical) flows through Rf and produces only a ~mV static offset. The effective overvoltage is V(CATH) − V(VBOT) = 32.4 − 2.4 = 30.0 V above... (set HV so that CATH − VBOT = Vbr + 3 V; with Vbr ≈ 53 V the real setpoint is HV_QUIET ≈ 58.4 V — the 32.4 V used in simulation is a placeholder that does not affect signal behavior, since only the pulse charge matters. **If the onsemi MicroFC-30035 is adopted, HV_QUIET ≈ 27.4 + 2.4 ≈ 29.8 V and the TPS61170 single-inductor boost shown in `hv_bias.svg` applies directly. For the Hamamatsu part, substitute a higher-ratio boost or the original MAX1932 — the filter chain and trim/readback structure are identical.**)

Pulse polarity: avalanche current is injected *into* the summing node, so TIA_OUT swings **down** from the 2.40 V baseline. The comparator takes TIA_OUT on IN+ and the threshold on IN−, producing the **active-low, idle-high** pulse the existing firmware/PIO convention and the planned iCE40 capture logic expect.

## 2. Design values and the reasoning behind them

**Rf = 2 kΩ, 1 %.** Sets transimpedance. Simulated conversion gain is **24.4 mV per photoelectron** (see §3) — 1 % resistors match the four channels to 1 %, so one DAC threshold table serves all channels.

**Cf = 2.2 pF, C0G.** From Cf = √(Cin/(π·Rf·GBW)) with Cin ≈ 143 pF (140 pF SiPM + clamps/protection ≈ 3 pF) and GBW = 5.5 GHz: 2.08 pF → 2.2 pF standard value. The AC sweep confirms this is the Butterworth point: **0.0 dB peaking, f₋₃dB = 52.5 MHz**. Cf = 1.0 pF peaks 3.6 dB (rings in transient); 4.7 pF is overdamped at 19 MHz. The OPA858 is decompensated (min gain 7), which is safe here because the high-frequency noise gain is 1 + Cin/Cf ≈ 66.

**OPA858 on a single 3.3 V rail.** VBOT = 2.40 V baseline leaves 2.25 V of downward swing to the lower output clamp — a linear range of **~92 p.e.** before clipping. FET input ⇒ negligible current noise into 2 kΩ. Iq ≈ 20 mA/channel; the accepted power cost. The drop-in lower-power alternative is characterized in §3.

**R2 = 10 Ω + BAV99 clamps.** Protects the input during HV power-up/fault transients (the SiPM terminal capacitance dumps charge when bias steps). 10 Ω adds negligible noise and, with the clamp capacitance, is included in the simulated Cin.

**TLV3601.** 2.5 ns tpd, ~1 mA, push-pull, ~6 mV internal hysteresis (modeled). With the smallest operating threshold at 1 p.e. = 24 mV, the hysteresis never causes chatter; overdrive at a 3 p.e. threshold is many times the hysteresis. R5 = 33 Ω damps the line into the iCE40 pin.

**Thresholds.** DAC7578 from the 3.3 V rail: LSB = 0.806 mV = **0.033 p.e.** — far finer than needed. Nominal operating point CHx_THRESH = 2.326 V = 3.0 p.e. below baseline. The threshold-scan calibration mode sweeps this code; the single-p.e. staircase appears at codes within ~30 LSB of baseline.

## 3. Simulation results (ngspice, full chain SiPM → TIA → comparator)

Pulse model: double-exponential current, Q = 270 fC/p.e. (gain 1.7×10⁶), τ_rise = 1 ns, τ_decay = 13.2 ns (Rq·Cpix), 140 pF terminal capacitance, 0.2 µA dark current. Op-amp macromodels are built from datasheet parameters (GBW, Aol, slew, swing, anti-windup-clamped internal nodes); the comparator model includes hysteresis and 2.5 ns tpd.

| Quantity | OPA858 (Cf 2.2p) | OPA356 (Cf 11p) |
|---|---|---|
| Conversion gain | 24.4 mV/p.e. | 11.8 mV/p.e. |
| Closed-loop bandwidth | 52.5 MHz | ~10 MHz |
| Linear range | ~92 p.e. | ~190 p.e. |
| ToT @ 30 p.e. (3 p.e. thr.) | 42 ns | 77 ns |
| ToT model (fit, 4–75 p.e.) | **ToT = 14.6·ln(Npe) − 7.5 ns** | similar slope, +35 ns offset |
| Time-walk, 4 → 800 p.e. | **6.7 ns** | 19.1 ns |
| 500 p.e. overload recovery | clean, output settled ≈ 140 ns after pulse start, no re-trigger | clean |
| Iq per channel | ~20 mA | ~8 mA |

Key conclusions:

ToT follows the predicted logarithm with slope ≈ the SiPM decay constant, confirming ToT as a useful compressed-energy estimator: dark/few-p.e. events (<3 p.e. never trigger; 4–6 p.e. give 12–19 ns) are cleanly separated from muons (≈40 ns) with 10 ns FPGA bins. Above the ~92 p.e. clip point ToT continues to grow but compresses and is not perfectly monotonic through the saturation region — **classify events beyond ~75 p.e. simply as "large"** rather than reading energy from them.

Time-walk of 6.7 ns across the entire dynamic range means a 50 ns coincidence window has enormous margin, and GPS-disciplined inter-station timing at the ~10 ns level is limited by the scintillator/fiber, not this electronics.

The OPA356 variant works: same logarithmic ToT, comfortably resolvable, 12 mA/channel cheaper. Its penalties are 3× the time-walk and half the gain. Both are acceptable for coincidence counting; the OPA858 is recommended as designed since the 20 mA budget was accepted, with OPA356 as the documented fallback if the power budget tightens (note: **not pin-compatible** — it is a layout decision, not a BOM swap).

## 4. Noise and ripple budget (analytic, cross-checked against sim values)

Output-referred amplifier noise: en × (1 + Cin/Cf) × √(1.57·f₋₃dB) = 2.5 nV/√Hz × 66 × 9.1 kHz^½ ≈ **1.5 mV rms = 0.06 p.e. rms**. Rf Johnson noise adds 52 µV rms — negligible. A 3 p.e. threshold therefore sits ≈ 48 σ above electronic noise: the trigger rate is set entirely by SiPM dark counts, never by electronics.

HV ripple feedthrough: ripple on CATH couples through the 140 pF as i = C·dV/dt into the summing node. Filter rejection at the 1.2 MHz switching frequency: R10/C12 stage ≈ 84 dB, per-channel 100k/100n ≈ 98 dB, plus the L2/C11 stage. Even 10 mV of ripple on HV_RAW arrives at the input equivalent to ≪ 0.001 p.e. The dominant residual coupling path on a real board is **magnetic/layout coupling from the boost inductor hot loop** — a layout constraint (keep the boost loop tiny and far from the four INA nodes), not a filtering one.

Gain stability: SiPM gain ∝ overvoltage; the bias chain drops < 0.1 V at sub-µA average currents through 100 kΩ, so rate-dependent bias droop is < 0.4 % gain even at 10× expected singles rates.

## 5. Reference netlist (per channel — ground truth for schematic capture)

```
* CHx analog front end (x = 0..3)
R1   HV_QUIET  CATHx    100k
C1   CATHx     GND      100n  ; 50V (≥100V if Hamamatsu HV), C0G/film
D1   CATHx     INAx_raw S13360-2050VE  ; cathode to CATHx, anode to R2
R2   INAx_raw  INAx     10
D2a  INAx      +3V3     BAV99 (half)
D2b  GND       INAx     BAV99 (half)
U1   OPA858: IN- = INAx, IN+ = VBOTFx, OUT = TIAx, V+ = +3V3, V- = GND
Rf   INAx      TIAx     2k 1%
Cf   INAx      TIAx     2.2p C0G
R3   CHx_VBOT  VBOTFx   1k
C2   VBOTFx    GND      100n
U2   TLV3601: IN+ = TIAx, IN- = VTHFx, OUT = CMPRAWx, V+ = +3V3
R4   CHx_THRESH VTHFx   1k
C3   VTHFx     GND      100n
R5   CMPRAWx   CHx_CMP  33
* decoupling at U1: 100n + 2.2u at pins; at U2: 100n
```

HV chain (shared): boost (TPS61170 for ~30 V MicroFC / MAX1932 for ~58 V Hamamatsu) → C10 1µ → L2 100µ → C11 1µ → R10 1k → C12 2.2µ film/C0G → HV_QUIET; FB divider R11 270k / R12 10k with R13 100k to HV_TRIM (DAC channel or filtered PWM) for setpoint control; R14 1M / R15 62k divider from HV_QUIET to HV_MON → nRF9151 ADC (÷17.1).

DAC budget note: the four CHx_VBOT references can share **one** DAC channel (all baselines identical by design), freeing three DAC channels — enough for HV_TRIM plus two future second-threshold channels (dual-ToT upgrade) without changing the DAC7578.

## 6. Bill of materials, analog section (verify live LCSC stock before ordering)

| Ref | Part | Qty | Notes |
|---|---|---|---|
| U1 | TI OPA858 (DSG-8/WSON) | 4 | TIA; fallback layout option OPA356/OPA357 |
| U2 | TI TLV3601 (SOT-23-5/DSF) | 4 | or TLV3603 for pin-set hysteresis |
| U10 | TI TPS61170 | 1 | MicroFC variant; MAX1932 if Hamamatsu retained |
| D1 | SiPM: onsemi MicroFC-30035-SMT *or* S13360-2050VE | 4 | likely hand-place; everything else JLC |
| D2 | BAV99 | 4 | dual clamp |
| Rf | 2 kΩ 1 % 0402 | 4 | gain-setting |
| Cf | 2.2 pF C0G 0402 | 4 | use 1.5–4.7 pF range for bench tuning kit |
| C1/C12 | 100n / 2.2µ, 50–100 V C0G or film | 4/1 | **voltage rating per SiPM choice; avoid X7R at high DC bias (capacitance collapse)** |
| L2 | 100 µH shielded | 1 | π filter |
| — | DAC7578, BME280, iCE40UP5K-SG48, LC76G GNSS, TCXO ±2 ppm, nRF9151 module | — | per system plan |

Indicative analog power at 3.3 V: 4×20 mA (TIA) + 4×1 mA (cmp) ≈ **84 mA ≈ 0.28 W**; OPA356 variant ≈ 37 mA ≈ 0.12 W.

## 7. Layout rules distilled from the simulation findings

The Cf = 2.2 pF compensation assumes ≤ ~0.3 pF of uncontrolled feedback/summing-node parasitics: keep INAx copper minimal, no plane under the summing node and feedback components, Rf/Cf directly at the amplifier pins. The SiPM-to-R2 trace adds to Cin (slows bandwidth slightly — benign) but its loop area sets magnetic pickup from the boost converter — keep the boost stage at the far end of the board with a compact hot loop. Comparator outputs are 3.3 V/1 ns edges: route them away from all four INA nodes and reference them to a solid ground pour so their return current cannot cross the analog region (this is the main self-interference risk, since a CMP edge coupling into a neighboring INA fakes a coincidence). Star the HV_QUIET distribution after C12 so channels don't share filter impedance.

## 8. Bench validation plan (maps to the simulation set)

Inject charge through a 1 pF test capacitor into INAx with a fast step generator: 270 fC/step-volt ≈ 1 p.e./0.27 V. Reproduce, in order: (1) the 24.4 mV/p.e. gain; (2) the AC flatness indirectly via transient ringing at Cf = 1.0/2.2/4.7 pF (the tuning-kit values); (3) the ToT-vs-charge logarithm against `tot_vs_npe.png`; (4) overload recovery at ≈ 100× threshold charge confirming no re-trigger (if re-triggers appear on hardware that the sim doesn't show, suspect ground bounce, not the amplifier); (5) dark-rate-vs-threshold staircase with a real SiPM in the dark, which also calibrates DAC code → p.e. per channel.

## 9. Files in this package

`sim/lib_frontend.lib` — SiPM, OPA858, OPA356, TLV3601 models · `sim/ch_opa858.cir` + `sim/run_sweep.sh` — parametric channel testbench · `sim/ac_tia.cir` — closed-loop AC/stability · `sim/analyze.py` — reproduces all plots · `plots/` — pulse family, ToT curve, time-walk, Cf stability, amplifier comparison · `sch/` — channel schematic, HV bias chain, system block diagram (SVG + PNG).
