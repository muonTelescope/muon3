# TPS61170 SiPM high-voltage boost

Preferred MPN: `TPS61170DRVR`

**Status: legacy / MicroFC reference only.**  
The HCal-tile workstation freezes on **LT3482 C515895** + Hamamatsu S12572
(see `../hv_lt3482/`). Keep TPS61170 docs for ~30 V MicroFC experiments only.

Current role (legacy): generate adjustable SiPM bias around the MicroFC-30035
operating range (~28–30 V).

Why selected:

- Corrected JLCPCB/LCSC code from prior audit: `C15163`.
- Compact high-voltage boost controller with enough range for roughly 30 V SiPM
  operation.
- Familiar topology for low-current sensor bias.

Design cautions:

- Output-voltage margin is limited; include OVP and verify maximum bias plus
  temperature compensation.
- Keep switch node and diode loop away from TIA summing nodes.
- Provide bleed/discharge and firmware-readable bias monitor.
- **Not suitable for Hamamatsu S12572-33-015P** (sPHENIX HCal MPPC, Vop ~68–72 V).
  That device needs a separate high-voltage path; see
  `sim/circuit/HAMAMATSU_SIPM_COMPATIBILITY.md` and
  `pcb/parts/sipm_hamamatsu_s12572/`.

Alternates:

- Higher-voltage boost controller if overvoltage/temperature range needs more
  headroom.
- Existing MAX1932-style HV approach from older MPPC project, if availability
  and control range become better than TPS61170 — **required class of solution**
  if Hamamatsu S12572 (or other ~50–70 V MPPCs) must be biased on-station.

Downloaded: `TPS61170.pdf`
