# W25Q128JV SPI flash

Preferred MPN: `W25Q128JVSIQ`

Current role: FPGA configuration/data flash and general nonvolatile storage.

Why selected:

- Common Winbond serial NOR family with ample capacity.
- SOIC-8 208 mil is friendly for prototype inspection and rework.
- Easy to qualify against iCE40 programming flows.

Design cautions:

- Multiple LCSC entries exist; select the current genuine Winbond JLC-assembled
  catalog line at order time.
- Confirm voltage variant and footprint before KiCad symbol/footprint freeze.

Alternates:

- `W25Q64JVSIQ`: lower capacity fallback.
- GigaDevice-compatible flash only after checking JEDEC ID and FPGA tooling.

Downloaded: `W25Q128JV.pdf`
