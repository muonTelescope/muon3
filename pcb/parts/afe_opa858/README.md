# OPA858 TIA

Preferred MPN: `OPA858IDSGR`

Current role: one transimpedance amplifier per SiPM channel.

Why selected:

- Very low input bias current and low input capacitance suit SiPM charge pulses.
- The data sheet explicitly targets fast optical receiver/TIA use.
- Prior audit found JLCPCB assembly support as `C970232`.
- The WSON package is layout-sensitive but compact enough for four channels.

Design cautions:

- It is decompensated and stable only at sufficient closed-loop gain.
- Bias and supply rails must keep the input common-mode and output swing inside
  data-sheet limits; the older 3.3 V/VBOT approach should not be reused blindly.
- Keep feedback and summing node extremely short, with a local no-copper pour
  region and guard strategy chosen after simulation.

Alternates:

- `OPA846IDBVR`: known from the older project and easier SOT-23 assembly, but
  higher input-current/noise tradeoffs.
- OPA356-class lower-power amplifier: only if timing/noise simulations show
  enough margin for coincidence and tracking.

Downloaded: `OPA858.pdf`
