# CH224K USB-C PD sink

Preferred MPN: `CH224K`

Current role: fixed USB-C PD contract request, nominally 12 V for Peltier and
system rails, with lower-power fallback behavior.

Why selected:

- Prior audit found JLCPCB/LCSC `C970725`.
- Small, inexpensive, and much simpler than a full policy-engine PD controller.
- Supports the fixed-voltage PD profiles needed for this system class.

Design cautions:

- Needs a real USB-C receptacle, CC network, TVS, fuse/eFuse, reverse-current
  strategy, and bulk capacitance.
- Firmware must know the negotiated/available power class before enabling
  Peltiers.
- Download the official WCH data sheet/manual before schematic freeze.

Alternates:

- `TPS25730DREFR`, prior audit `C22438973`: more capable and better documented,
  but larger and more complex.
- USB-C 5 V sink only: electronics test fallback, not a cooling-capable build.

Manual/blocked: WCH's current CH224K document portal needs a separate fetch and
exact package confirmation.
