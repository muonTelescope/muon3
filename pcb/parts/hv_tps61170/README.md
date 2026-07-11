# TPS61170 SiPM high-voltage boost

Preferred MPN: `TPS61170DRVR`

Current role: generate adjustable SiPM bias around the MicroFC-30035 operating
range.

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

Alternates:

- Higher-voltage boost controller if overvoltage/temperature range needs more
  headroom.
- Existing MAX1932-style HV approach from older MPPC project, if availability
  and control range become better than TPS61170.

Downloaded: `TPS61170.pdf`
