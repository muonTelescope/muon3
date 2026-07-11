# DRV8873 Peltier H-bridge

Preferred MPN: `DRV8873HPWPR`

Current role: one bidirectional current-regulated driver per SiPM/Peltier
channel.

Why selected:

- Integrated H-bridge with current regulation, diagnostics, and protection.
- Prior audit found JLCPCB/LCSC `C2150604`, but with low stock.
- Lets firmware heat or cool for condensation control and warm-climate operation.

Design cautions:

- Reserve stock early or qualify `DRV8876PWPR`.
- Add local fuse/current limit, bulk capacitance, filtered current readback, and
  independent overtemperature shutdown.
- USB-C operation demands negotiated-power-aware derating.

Alternates:

- `DRV8876PWPR`: likely practical if diagnostics/current-sense tradeoffs are OK.
- Discrete MOSFET H-bridge: only if supply-chain pressure justifies the extra
  gate-drive and protection burden.

Downloaded: `DRV8873.pdf`
