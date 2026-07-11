#!/bin/bash
#
# Helper script to build the Muon3 panel simulation against a system Geant4 install.
#
# Usage:
#   ./build_with_system_geant4.sh [path_to_geant4_install]
#
# Example (after building Geant4 to $HOME/geant4/install):
#   ./build_with_system_geant4.sh ~/geant4/install
#

set -e

GEANT4_INSTALL=${1:-$HOME/geant4/install}

if [ ! -d "$GEANT4_INSTALL" ]; then
  echo "Geant4 install dir not found: $GEANT4_INSTALL"
  echo "Please build Geant4 first and pass the install prefix, or set default in this script."
  exit 1
fi

echo "Using Geant4 from: $GEANT4_INSTALL"

mkdir -p build
cd build

cmake -DCMAKE_BUILD_TYPE=Release \
      -DGeant4_DIR="$GEANT4_INSTALL/lib/Geant4-11.3.0" \
      -DWITH_ROOT=OFF \
      ..

make -j$(sysctl -n hw.ncpu || echo 4)

echo ""
echo "Build complete. Run with:"
echo "  ./build/muon_panel -m ../macros/run.mac"
echo ""
echo "For visualization:"
echo "  ./build/muon_panel -m ../macros/vis.mac"
