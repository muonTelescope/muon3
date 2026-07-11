# Per-channel NTC

Status: exact part still open.

Role: one temperature sensor at each SiPM/Peltier assembly.

Selection target:

- 10 kOhm NTC, beta around 3950 K unless thermal modeling says otherwise.
- Physically mountable at the SiPM cold plate or sensor package, not only on the
  main PCB.
- Connector/probe choice must survive condensation and field service.

Design cautions:

- Divider values should keep useful ADC resolution over cold and hot operation.
- Use the NTC for both bias compensation and Peltier safety shutdown.
- Add firmware plausibility checks for open/shorted probes.

Open action: choose exact probe/thermistor and connector after mechanical design.
