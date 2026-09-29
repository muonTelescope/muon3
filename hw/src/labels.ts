// Board-specific silkscreen: what a teacher needs to plug in, charge and not get hurt.
import type { Board } from "./board.ts";
import { text } from "./silk.ts";
import { JACK_X, HOLDER_X, HOLDER_Y } from "./floorplan.ts";
import { pt } from "./geom.ts";

export function labels(b: Board, date: string) {
  const find = (lcsc: string) => b.parts.filter(p => p.lcsc === lcsc);
  const at = (ref: string) => b.parts.find(p => p.ref === ref)!.place!;
  // jacks
  JACK_X.forEach((x, i) => text(b, `TILE ${i}`, pt(x, 9.2), 1.2, { align: "center" }));
  text(b, "SMA SHELL = SIPM BIAS UP TO 80V (47K LIMITED)", pt(50, 1.4), 0.9, { align: "center" });
  // cells: + at the top contact, - at the bottom contact
  HOLDER_X.forEach((x, i) => {
    text(b, "+", pt(x - 7.5, HOLDER_Y - 40.6), 2.5, { align: "center" });
    text(b, "-", pt(x - 7.5, HOLDER_Y + 40.4), 2.5, { align: "center" });
    text(b, `18650 #${i + 1}`, pt(x, HOLDER_Y), 2.0, { rot: 90, align: "center" });
  });
  text(b, "4X 18650 IN PARALLEL: SAME TYPE, SAME CHARGE. RED LED = CELL REVERSED", pt(50, HOLDER_Y + 44.1), 0.9, { align: "center" });
  // connectors / controls
  const usb = at("J1"); text(b, "USB-C 5V", pt(usb.x + 6.5, usb.y - 5.2), 1.0);
  const qt = at("J6"); text(b, "STEMMA QT 3V3", pt(qt.x + 4.2, qt.y + 3.8), 0.9);
  for (const sw of b.parts.filter(p => /^SW/.test(p.ref))) text(b, "BOOT", pt(sw.place!.x, sw.place!.y - 3.4), 0.9, { align: "center" });
  for (const d of b.parts.filter(p => p.lcsc === "C2286")) text(b, d.value.replace("REV", "R"), pt(d.place!.x, d.place!.y + 1.5), 0.8, { align: "center" });
  // HV warning next to the bias supply
  const hv = find("C2650346")[0]?.place;
  if (hv) { text(b, "HV 80V", pt(hv.x, hv.y - 4.2), 1.2, { align: "center" }); }
  // title block (clear area above the cells)
  text(b, "MUON3 STATION REV B", pt(3.2, HOLDER_Y), 1.8, { rot: 90, align: "center" });
  text(b, `GSU GLOWCOST  ${date}`, pt(5.6, HOLDER_Y), 1.0, { rot: 90, align: "center" });
  // JLC order-number placeholder on the bottom
  text(b, "JLCJLCJLCJLC", pt(50, HOLDER_Y - 30), 1.0, { align: "center", layer: "bottom" });
}
