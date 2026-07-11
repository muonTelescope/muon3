# nRF9151 LTE-M/NB-IoT/GNSS

Preferred MPN: `nRF9151-LACA-R7`

Current role: application MCU, LTE-M/NB-IoT modem, GNSS/PPS source, telemetry,
and station control.

Why selected:

- User-selected part and the right integration level for field stations.
- Prior audit found JLCPCB/LCSC `C22397843`, Standard PCBA with X-ray.
- Removes the uncertainty of carrier headers and external modem modules.

Design cautions:

- Follow Nordic's reference circuit for RF, supplies, decoupling, SIM, debug,
  and antenna matching.
- The LGA footprint and RF routing are not forgiving; do not improvise fanout.
- Support both nano-SIM and optional MFF2 eSIM/DNP, with Onomondo or Telekom
  profile provisioning as deployment choices.

Source documents:

- `nRF9151-product-specification.html` is the downloaded Nordic web-bundle entry
  returned by the documentation portal.
- Key official sections include pin assignments, reference circuitry, mechanical
  specifications, RF, SIM, power, and regulatory information in the Nordic
  product-specification bundle.
