#!/bin/bash
# Build script for Muon3_Simulation_Studies paper
# Run this after installing LaTeX (see below)

set -e

# Optional: Pull latest images from Google Photos before building
# Usage: ./build_paper.sh --pull-images
if [[ "$1" == "--pull-images" ]]; then
    echo "Pulling documentation images from Google Photos..."
    if [ -f scripts/pull_google_photos.py ]; then
        (cd scripts && python3 pull_google_photos.py --album "Muon3 Documentation" --dest ../figures/google) || echo "Warning: Image pull failed or not configured. Continuing..."
    else
        echo "pull_google_photos.py not found. See scripts/README.md for Google Photos setup."
    fi
    echo ""
fi

echo "Building Muon3_Simulation_Studies.pdf ..."

pdflatex -interaction=nonstopmode Muon3_Simulation_Studies.tex
bibtex Muon3_Simulation_Studies
pdflatex -interaction=nonstopmode Muon3_Simulation_Studies.tex
pdflatex -interaction=nonstopmode Muon3_Simulation_Studies.tex

echo "Done. PDF size:"
ls -lh Muon3_Simulation_Studies.pdf

echo ""
echo "To view: open Muon3_Simulation_Studies.pdf"
echo ""
echo "Tip: Run with --pull-images to fetch latest figures from the Google Photos album first."
