#!/bin/sh
# Build the FreeCAD assembly + Blender renders for all 12 inner-HCal tile shapes, one heavy job at a time (memguard).
# The full view set (sections, exploded electronics, assembly steps) is rendered for the shapes in FULL; every shape gets the
# overview views. Needs hw/out/case/*.step (freecadcmd hw/case/case.py) and hw/out/assembly/pcb.step (kicad-cli pcb export step).
# Usage: sh hw/case/build_assemblies.sh
cd "$(dirname "$0")/.."
G=../tools/memguard.sh
FC=/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd
FULL="1 6 12"
for t in 1 2 3 4 5 6 7 8 9 10 11 12; do
  n=$(printf %02d "$t"); sec=0; views=iso_front,iso_back,top,top_fixed
  for f in $FULL; do
    if [ "$f" = "$t" ]; then
      sec=1
      views=iso_front,iso_back,top,top_fixed,side,sec_x,sec_x_sipm,sec_x_case,sec_zcase,sec_ztile,detail_coupler,explode_elec,panel_bare,panel_layers,step1,step2,step3,step4,step5
    fi
  done
  TILE=$t SECTIONS=$sec $G -l 3500 -f 800 -t 2400 -- $FC case/assembly.py 2>&1 | grep -E "^tile|Error|Traceback"
  $G -l 3500 -f 800 -t 1800 -- blender -b --factory-startup --python case/render_assembly.py -- "out/assembly/tile$n/manifest.json" out/assembly/render "$views" 2>&1 | grep -E "Error|Traceback"
  [ "$t" = 1 ] || rm -rf "out/assembly/tile$n/stl" "out/assembly/tile$n/station.FCStd"   # disk is tight: keep the full-view shapes only
done
