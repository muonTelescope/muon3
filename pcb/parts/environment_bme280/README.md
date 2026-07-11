# BME280 atmospheric sensor

Preferred MPN: `BME280`

Current role: pressure, humidity, and board temperature for atmospheric rate
monitoring and environmental diagnostics.

Why selected:

- Prior audit found JLCPCB/LCSC `C92489`.
- Pressure and humidity are both useful for correcting cosmic-ray station data.
- Small I2C sensor with familiar firmware support.

Design cautions:

- Place with environmental exposure, not buried under heat sources.
- Keep away from Peltier exhaust/thermal gradients if the goal is atmospheric
  correction rather than local board heating.

Alternates:

- `BMP390`: pressure-focused alternate.
- `BME680`: adds gas sensing but increases power/complexity.

Downloaded: `BME280.pdf`
