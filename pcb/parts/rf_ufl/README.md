# RF U.FL connectors

Preferred candidate: `BWU.FL-IPEX1`

Role: LTE and GNSS antenna connectors.

Why selected:

- Prior audit found JLCPCB/LCSC `C5137195`.
- Small, common, and suitable for 50 Ohm RF antenna connections.

Design cautions:

- Use U.FL only for RF with grounded shell.
- Do not reuse this connector style for SiPM HV.
- Follow nRF9151 reference layout, matching, keepout, and antenna vendor
  guidance.

Alternates:

- Hirose U.FL exact part if JLC availability is acceptable.
- Murata-style connector only with matching cable ecosystem and footprint.

Open action: choose LTE and GNSS antennas, then finalize matching network.
