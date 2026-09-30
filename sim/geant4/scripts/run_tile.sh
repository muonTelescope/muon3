#!/bin/sh
# Run hcal_tile for inner-HCal tile N (1-12) with EVENTS muons; writes OUTDIR/muon_panel_hits.csv and prints the yield.
# usage: G4BUILD=<dir with hcal_tile> [G4RUN="micromamba run -p <env>"] sh scripts/run_tile.sh N EVENTS OUTDIR
N=$(printf %02d "$1"); EV=${2:-400}; OUT=${3:-run$N}; HERE=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$OUT" && cd "$OUT" && ln -sfn "$HERE/gdml" gdml
read X Y Z HX HY <<EOF
$(python3 -c "import json;P=json.load(open('$HERE/gdml/mesh/InnerHCalTile${N}_EJ200_mesh.json'))['params'];b=P['bbox'];print((b['xmin']+b['xmax'])/2,(b['ymin']+b['ymax'])/2,P['z_mid_mm'],b['dx']/2,b['dy']/2)")
EOF
printf '/run/initialize\n/run/verbose 0\n/run/beamOn %s\n' "$EV" > run.mac
${MEMGUARD:-} ${G4RUN:-} "$G4BUILD/hcal_tile" -g "gdml/mesh/InnerHCalTile${N}_EJ200_mesh.json" --tile-center $X $Y $Z $HX $HY run.mac > run.log 2>&1
python3 - <<P
import csv, statistics as st
r = list(csv.DictReader(open('muon_panel_hits.csv'))); c = [int(x['photons_detected']) for x in r if float(x['edep_MeV']) > 0.3]
print("tile $N: %d muons, %d cross the tile, <p.e.> %.1f (sigma %.1f, min %d), >= 5 p.e.: %.1f %%" % (len(r), len(c), st.mean(c), st.pstdev(c), min(c), 100 * sum(v >= 5 for v in c) / len(c)))
P
