# USB-C receptacle

Status: exact part still open.

Role: USB 2.0 and PD sink connector for station power, debug, and local data.

Selection target:

- JLCPCB-assembled USB-C receptacle with enough mechanical retention for field
  service.
- Through-hole shell stakes preferred if they do not break assembly constraints.
- USB2-only routing is acceptable; SuperSpeed pairs are not required.

Design cautions:

- Shell should be tied to chassis/ground strategy through the selected EMI/ESD
  network.
- CC pins must match the selected CH224K/TPS25730 circuit.
- Add TVS and input protection before the connector reaches the rest of the PCB.

Open action: confirm a current JLC basic/extended part and exact footprint.
