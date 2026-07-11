# iCE40UP5K FPGA

Preferred MPN: `ICE40UP5K-SG48I`

Current role: deterministic coincidence, timestamping, pulse capture, and
firmware-bypassable holdoff logic.

Why selected:

- Carries forward the MPPC interface design direction.
- Prior audit found JLCPCB/LCSC `C2678152`.
- Enough logic and RAM for channel masks, counters, and timing glue while
  staying easy to build with open-source FPGA tooling.

Design cautions:

- VCC/VCCPLL are 1.2 V; VCCIO is 3.3 V. Do not repeat any 3.3 V PLL mistake.
- Freeze a pin map only after checking nRF9151, DAC, comparator, PPS, and flash
  requirements together.
- Keep programming/debug access exposed.

Manual/blocked: Lattice blocked automated PDF download with HTTP 403. The
official source opened in browser/web tooling:
`https://www.latticesemi.com/view_document?document_id=51968`
