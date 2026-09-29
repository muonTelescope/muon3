// Board-specific silkscreen: what a teacher needs to plug in and not get hurt.
import type { Board } from "./board.ts";
import { text } from "./silk.ts";
import { JACK_X, W, H } from "./floorplan.ts";
import { pt } from "./geom.ts";

export function labels(b: Board, date: string) {
  JACK_X.forEach((x, i) => text(b, `TILE ${i}`, pt(x + 5.2, 5.4), 1.1, { align: "center" }));
  text(b, "SMA SHELL = SIPM BIAS UP TO 80V (47K LIMITED)", pt(W / 2, H - 1.4), 0.9, { align: "center" });
  const usb = b.parts.find(p => p.ref === "J1")!.place!; text(b, "USB-C 5V", pt(usb.x + 6.5, usb.y - 5.2), 1.0);
  const qt = b.parts.find(p => p.ref === "J6")!.place!; text(b, "STEMMA QT", pt(qt.x + 4.2, qt.y + 3.8), 0.9);
  for (const sw of b.parts.filter(p => /^SW/.test(p.ref))) text(b, "BOOT", pt(sw.place!.x, sw.place!.y - 3.4), 0.9, { align: "center" });
  for (const d of b.parts.filter(p => p.lcsc === "C2286")) text(b, d.value, pt(d.place!.x, d.place!.y + 1.5), 0.8, { align: "center" });
  const hv = b.parts.find(p => p.lcsc === "C2650346")?.place;
  if (hv) text(b, "HV 80V", pt(hv.x, hv.y - 4.2), 1.2, { align: "center" });
  text(b, `MUON3 STATION REV B  ${date}`, pt(W / 2, H / 2), 1.4, { align: "center", layer: "bottom" });
  text(b, "GSU GLOWCOST", pt(W / 2, H / 2 + 2.4), 1.0, { align: "center", layer: "bottom" });
  text(b, "JLCJLCJLCJLC", pt(W / 2, H / 2 + 5), 1.0, { align: "center", layer: "bottom" });
}
