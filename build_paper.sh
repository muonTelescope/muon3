#!/bin/bash
# Build script for Muon3_Simulation_Studies paper
# Run this after installing LaTeX (see below)

set -e

echo "Building Muon3_Simulation_Studies.pdf ..."

pdflatex -interaction=nonstopmode Muon3_Simulation_Studies.tex
bibtex Muon3_Simulation_Studies
pdflatex -interaction=nonstopmode Muon3_Simulation_Studies.tex
pdflatex -interaction=nonstopmode Muon3_Simulation_Studies.tex

echo "Done. PDF size:"
ls -lh Muon3_Simulation_Studies.pdf

echo ""
echo "To view: open Muon3_Simulation_Studies.pdf"
