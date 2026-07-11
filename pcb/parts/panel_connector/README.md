# Panel connector

Status: release blocker (exact family still open); architecture fixed 2026-07-11.

Role: single hybrid locking, touch-safe, keyed connection to each scintillator
panel assembly — one connector per channel, four per board. The earlier
separate-coax-plus-auxiliary scheme is retired.

Fixed inputs from the 2026-07-11 decisions:

- One hybrid connector carries everything to the panel.
- Baseline cable length: 50 cm.
- TEC is a CP30238 driven at up to 2.5 A (ITRIP ceiling), so TEC contacts must
  be rated 3 A continuous with margin at 50 cm round trip.
- Fan power and tach are carried in the same cable.

Required conductors:

- SiPM signal + shield/return (shielded contact or dedicated shielded pair
  within the hybrid cable; shield at ground, never at bias).
- SiPM bias (touch-safe, recessed contact).
- Cold-side NTC pair and hot-side NTC pair.
- TEC positive/negative (H-bridge output pair, 3 A continuous).
- Fan +12 V, fan return, fan tach.

Selection target:

- Polarized locking family with mixed signal/power contacts, or a compact
  circular locking connector.
- Creepage/clearance suitable for the ~30 V SiPM bias, including field
  contamination.
- JLCPCB-assembled board side strongly preferred (100% JLC assembly decision).

Rejected legacy pattern:

- Do not put SiPM HV on an exposed U.FL shield/shell.

Open action: evaluate JST-GH/Molex Micro-Lock (signal-only ratings are likely
insufficient for 3 A TEC contacts), Molex Micro-Fit 3.0 dual-row, and shielded
circular (M8/M12-class) families against the conductor list above, then verify
JLCPCB assembly support for the exact board-side part.
