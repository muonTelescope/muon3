# Passives and inductors

Status: partially selected.

Known candidate:

- `SWPA4030S100MT`, prior audit `C38117`, for TPS61170 boost inductor candidate.

Selection target:

- Use JLC basic parts for commodity resistors and capacitors where practical.
- Use exact qualified parts for switching inductors, RF passives, HV feedback,
  compensation, and current-sense positions.
- Prefer 0603 or larger for field-repairable passives unless analog/RF layout
  demands smaller.

Design cautions:

- Bias derating on MLCCs matters for 12 V, 20 V, and HV nodes.
- Inductor saturation current and DCR must be checked at temperature.
- HV divider resistors need voltage rating, not just resistance value.

Open action: generate the complete passive BOM after schematic values are frozen.
