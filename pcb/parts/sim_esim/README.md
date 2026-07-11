# SIM and eSIM

Status: exact parts still open.

Role: support physical SIM and optional soldered eSIM/MFF2.

Selection target:

- Nano-SIM holder with card-detect, JLCPCB-assembled if possible.
- MFF2 eSIM footprint as DNP/default option unless deployment needs it.
- Compatible with Onomondo or Telekom nuSIM/provisioning plans.

Design cautions:

- Follow Nordic SIM interface requirements, including ESD and trace guidance.
- Decide whether one or both SIM options can be populated at the same time.
- Keep SIM_DET behavior explicit in firmware.

Open action: select a JLC-stocked holder and eSIM package after provisioning
model is chosen.
