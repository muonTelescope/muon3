# Muon3 project-local footprints

This directory contains verified footprints for components not (or not reliably) available in the JLCPCB library, or that require project-specific modifications (e.g. for RF keepout, thermal pads, or hybrid connectors).

Currently includes (generated/verified):
- OPA858_WSON8_EP_2x2
- TPS61170_WSON6_EP_2x2
- ICE40UP5K_SG48I_QFN48_EP (simplified; use exact Lattice + JLC for production)
- CH224K_ESSOP10_EP
- DRV8873_HTSSOP24_EP
- nRF9151_LGA113 (PLACEHOLDER - MUST follow Nordic reference layout + keepouts exactly)
- UFL_IPEX
- USB_C_Receptacle_16P (basic; verify exact P/N)

All footprints here have been checked against the manufacturer datasheet and JLCPCB assembly rules (where applicable).

For standard JLCPCB parts, prefer the JLCPCB library (added to fp-lib-table via components/JLCPCB-Kicad-Library).

Add new footprints only after:
1. Confirming exact package dimensions from datasheet.
2. Verifying JLCPCB / LCSC footprint compatibility.
3. Adding thermal vias / paste where required.
