# Input and interface protection

Status: release blocker.

Role: protect USB-C input, panel connectors, SIM, RF-adjacent interfaces, and
external sensor lines.

Required blocks:

- USB-C VBUS TVS.
- Fuse or eFuse/current limiter sized for PD operation.
- Reverse-current/backfeed protection.
- CC/SBU/USB2 ESD as needed.
- Panel connector transient and fault protection.
- SiPM bias bleed/discharge path.

Design cautions:

- Protection selection must account for 12 V nominal PD and possible 20 V PD.
- Do not let protection capacitance damage SiPM timing or RF performance.
- Field cabling makes this a real reliability item, not decorative BOM padding.

Open action: choose exact JLC-stocked TVS/eFuse/ESD components with voltage,
capacitance, and surge ratings.
