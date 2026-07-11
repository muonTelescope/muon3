# TPS25751 USB-C PD Controller + Power Path

## Selection (updated 2026-07-xx per new requirements)
- Replaces CH224K.
- Full USB PD 3.2 controller with integrated power path management, support for external battery chargers, PPS.
- Enables true onboard battery + solar input support while still accepting high-power USB-C PD (up to 20 V / 5 A contracts).
- Works with TI BQ257xx family chargers for multi-chemistry charging, solar MPPT-like behavior, and proper system power path (VBUS vs battery priority).

## Key reasons over CH224K
- Bidirectional power path + battery charger integration.
- Hardware status signals usable for "sufficient PD contract" interlock.
- Programmable source/sink behavior.
- Better protection and moisture detection features in the family.

## Recommended companion
- BQ25792 or BQ25756 (see separate part folder).
- TPS25751 provides I2C control to the charger.

## Footprint / Assembly
- Check exact package (QFN or similar). JLCPCB assembly support for TI power parts varies; verify current LCSC mapping before layout freeze.
- Requires careful layout for high-current paths (5 A capable).

## References
- TI TPS25751 datasheet
- TI USB-PD EVM / reference designs with BQ chargers
- Nordic + TI power examples for cellular + battery instruments
