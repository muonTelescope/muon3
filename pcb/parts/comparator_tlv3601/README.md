# TLV3601 comparator

Preferred MPN: `TLV3601IDBVR`

Current role: two comparators per channel, low physics threshold and higher
shower/noise threshold.

Why selected:

- Fast propagation and low dispersion are a good fit for timestamp edges.
- Push-pull CMOS output is simpler than LVDS for the small iCE40 design.
- It is the performance reference already used in the next-generation analog
  simulations.

Design cautions:

- JLCPCB assembly stock is not confirmed yet, so this is not a frozen production
  choice.
- Confirm output polarity and firmware/FPGA edge assumptions; existing project
  history expects active-low falling-edge events.
- Add hysteresis only after checking threshold walk and double-pulse/lifetime
  mode requirements.

Alternates:

- `TLV3501`: slower but often easier to source.
- Analog Devices/Maxim `ADCMP6xx` family: viable if a JLC-stocked exact package
  and output type are found.

Downloaded: `TLV3601.pdf`
