/**
 * floorplan.tsx — draws the Muon3 placement floorplan on the board:
 * zone fences + labels, shield/keepout notes, antenna keepout, and the
 * four M3 mounting holes. Silkscreen/fab-note only (no copper) — these
 * become real copper keepouts/pours during routing.
 */
import { ZONES, HOLES, ANTENNA, BOARD_W, BOARD_H } from "./layout"

const mm = (v: number) => `${v}mm`

export const Floorplan = () => (
  <group name="FLOORPLAN" pcbX="0mm" pcbY="0mm">
    {/* Board title block (top edge) */}
    <silkscreentext
      text="MUON3 CONTROLLER  160x120  4-LAYER  |  S12572 + LT3482"
      pcbX="0mm"
      pcbY={mm(BOARD_H / 2 - 4)}
      fontSize="2mm"
      anchorAlignment="center"
    />
    <silkscreentext
      text="QUIET (RF / AFE / HV / DIGITAL)  ^^^      switching >= 25 mm      vvv  NOISY (PD / TEC)"
      pcbX="0mm"
      pcbY="0mm"
      fontSize="1.3mm"
      anchorAlignment="center"
    />

    {ZONES.map((z) => (
      <group name={`ZONE_${z.name}`} key={z.name} pcbX="0mm" pcbY="0mm">
        <silkscreenrect
          pcbX={mm(z.cx)}
          pcbY={mm(z.cy)}
          width={mm(z.w)}
          height={mm(z.h)}
          strokeWidth="0.2mm"
        />
        <silkscreentext
          text={z.label}
          pcbX={mm(z.cx)}
          pcbY={mm(z.cy + z.h / 2 - 2.5)}
          fontSize="1.4mm"
          anchorAlignment="center"
        />
        {z.shield ? (
          <fabricationnotetext
            text={z.shield}
            pcbX={mm(z.cx)}
            pcbY={mm(z.cy - z.h / 2 + 2)}
            fontSize="1mm"
            anchorAlignment="center"
          />
        ) : null}
      </group>
    ))}

    {/* Antenna keepout marker (RF edge) */}
    <fabricationnotetext
      text={`ANT KEEPOUT R${ANTENNA.keepoutR}mm`}
      pcbX={mm(ANTENNA.x + 6)}
      pcbY={mm(ANTENNA.y + ANTENNA.keepoutR + 2)}
      fontSize="1mm"
      anchorAlignment="center"
    />

    {/* M3 mounting holes */}
    {HOLES.map((h, i) => (
      <hole key={i} pcbX={mm(h.x)} pcbY={mm(h.y)} diameter="3.2mm" />
    ))}
  </group>
)

export default Floorplan
