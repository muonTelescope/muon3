# Dual DAC80508 (or equivalent 16-bit 8-ch precision DAC)

## Selection
- Two DAC80508 (TI) 16-bit, 8-channel, SPI, internal 2.5 V precision reference (5 ppm/°C).
- Replaces previous "one DAC60508 + small secondary DAC".

## Channel allocation (proposed)
DAC A (thresholds + test):
- 8 comparator threshold voltages (2 per physics channel)
- Possible charge injection amplitude control

DAC B (bias + control):
- SiPM HV trim / reference
- Up to 4 TEC current setpoints or voltage references (if analog control used)
- Calibration / optical test levels
- Spares for future monitoring DACs or temp compensation refs

## Advantages
- Higher resolution and better accuracy / tempco than DAC60508.
- One part number simplifies BOM.
- Internal reference reduces external precision ref parts.
- JLCPCB has stock variants (e.g. DAC80508MRTER, DAC80508ZYZFT etc. at time of review).

## Interface
- Shared or separate SPI buses from RP2040 or nRF9151 (or FPGA for low-latency updates).
- /CS, LDAC control as needed.

## References
- TI DAC80508 / DACx0508 family datasheet
- Current JLCPCB LCSC mappings in bom.csv
