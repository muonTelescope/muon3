# BQ25792 / BQ25756 Battery Charger + Power Path (companion to TPS25751)

## Selection
- Paired with TPS25751 for full onboard battery/solar support.
- Multi-chemistry (Li-ion, LiFePO4), up to 20-24 V input capable versions.
- Supports USB-C PD + DC input + solar panel input with power path management.
- I2C controlled from TPS25751 or main MCU.

## Why required now
User requirement: "onboard battery/solar or 20 V/5 A power management is required".

This + TPS25751 satisfies the upgraded power architecture (no longer USB-C-PD-input-only).

## Implementation notes
- Solar input path with appropriate MPPT or simple voltage window.
- Battery gauge / protection (separate or integrated features).
- System rail generation after the charger (12 V or direct to bucks for 3V3/1V2/TEC bus).

## Status
Selection pending exact BQ variant stock + JLC assembly confirmation. BQ25792 is a strong current candidate.
