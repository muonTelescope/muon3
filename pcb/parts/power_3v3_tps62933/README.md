# TPS62933 3.3 V buck candidate

Preferred family: `TPS62933`

Current role: main 3.3 V rail from USB-C PD input.

Why selected:

- 3.8 V to 30 V input covers 5 V fallback, 12 V nominal, and 20 V PD cases.
- 3 A output has useful margin for nRF9151 transmit bursts, FPGA I/O, sensors,
  DACs, flash, and housekeeping.
- Integrated compensation keeps the supply compact.

Design cautions:

- Exact JLCPCB catalog ID is still open.
- LTE burst load and RF noise require bulk capacitance and careful placement.
- Choose frequency/inductor values to keep EMI out of the TIA and RF sections.

Alternates:

- `TPS54302`: larger, easier-to-source TI buck in many assembly catalogs.
- `AP63203`: good low-cost 2 A class alternate if live JLC stock and transient
  response are acceptable.

Downloaded: `TPS62933.pdf`
