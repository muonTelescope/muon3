/**
 * Coordinate transforms between tscircuit (board-center, +Y up) and KiCad
 * (board top-left origin on the canvas, +Y down).
 *
 * tscircuit board:  [-W/2, W/2] × [-H/2, H/2], center = (0, 0)
 * KiCad placement:  board top-left at (ORIGIN_X, ORIGIN_Y)
 */
import { BOARD_W, BOARD_H } from "./muon3_placement.tsx"

/** KiCad canvas position of the board top-left corner (mm). */
export const KICAD_ORIGIN_X = 20
export const KICAD_ORIGIN_Y = 20

export function tscToKicad(x: number, y: number): { x: number; y: number } {
  return {
    x: KICAD_ORIGIN_X + BOARD_W / 2 + x,
    y: KICAD_ORIGIN_Y + BOARD_H / 2 - y,
  }
}

/** Axis-aligned rect center+size (tsc) → KiCad start/end corners. */
export function tscRectToKicad(
  cx: number,
  cy: number,
  w: number,
  h: number,
): { startX: number; startY: number; endX: number; endY: number } {
  const tl = tscToKicad(cx - w / 2, cy + h / 2)
  const br = tscToKicad(cx + w / 2, cy - h / 2)
  return {
    startX: round3(Math.min(tl.x, br.x)),
    startY: round3(Math.min(tl.y, br.y)),
    endX: round3(Math.max(tl.x, br.x)),
    endY: round3(Math.max(tl.y, br.y)),
  }
}

export function boardEdgeCutsKicad(): {
  startX: number
  startY: number
  endX: number
  endY: number
} {
  return {
    startX: KICAD_ORIGIN_X,
    startY: KICAD_ORIGIN_Y,
    endX: KICAD_ORIGIN_X + BOARD_W,
    endY: KICAD_ORIGIN_Y + BOARD_H,
  }
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}
