# Threshold and trim DACs (superseded)

Preferred MPN: `DAC60508ZRTET` (historical)

**Updated**: Two 8-channel precision DACs (DAC80508 class) are now required.
See `../dac_dual_80508/README.md`.

Historical role: eight comparator thresholds + HV trim.

Why selected:

- Eight outputs map naturally to four channels times two thresholds.
- Internal reference options reduce support circuitry.
- Better resolution and monotonicity margin than low-cost quad DAC fallbacks.

Design cautions:

- JLCPCB assembly stock remains unconfirmed.
- If thresholds must cover both low PE physics triggering and high shower
  rejection, define the output range and offset chain before freezing values.
- I2C/SPI bus sharing with nRF9151 and FPGA debug should be deliberate.

Alternates:

- `MCP4728`: widely available quad I2C DAC family; three devices cover 12
  outputs but require address planning and lower-resolution review.
- Legacy `DAC80508`: familiar from the earlier MPPC interface approach.

Downloaded: `DAC60508.pdf`

Manual/blocked: Microchip rejected automated direct PDF download for MCP4728
with HTTP 403. Source page:
`https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MCP4728-12-Bit-Voltage-Output-Digital-to-Analog-Convertor-with-EEPROM-Memory-DS20002249.pdf`
