#!/bin/bash
# Rebuild all modular stations; populated board STEP exports are prerequisites.
set -euo pipefail
cd "$(dirname "$0")/../.."
FC=${FREECAD_CMD:-/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd}
for tile in "$@"; do
    TILE="$tile" "$FC" hw/case/modular_v2.py > "/tmp/muon3-modular-$tile.log" 2>&1
    if ! rg -q "MODULAR_V2 tile $tile:" "/tmp/muon3-modular-$tile.log"; then
        tail -20 "/tmp/muon3-modular-$tile.log"
        exit 1
    fi
    python3 hw/case/pack_modular.py "$tile"
done
