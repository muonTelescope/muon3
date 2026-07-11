#!/usr/bin/env python3
"""
build_reports.py
Generate PDF reports from simulation results using fpdf2 (pure Python).
Also produces the LaTeX sources (already written).
Includes key plots and summary tables.
"""
import os
from fpdf import FPDF

BASE = os.path.dirname(os.path.abspath(__file__))
FIGS = os.path.join(BASE, "figures")
OUT = os.path.join(BASE, "Muon3_Simulation_Report.pdf")

class Report(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.cell(0, 8, "Muon3 P0 Simulation Report - 2026-07-11", 0, 1, "C")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}", 0, 0, "C")

    def chapter_title(self, title):
        self.set_font("Helvetica", "B", 14)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 8, title, 0, 1, "L", True)
        self.ln(3)

    def body(self, text):
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5, text)
        self.ln()

    def add_image_safe(self, path, w=170):
        if os.path.exists(path):
            self.image(path, w=w)
            self.ln(3)
        else:
            self.set_font("Helvetica", "I", 9)
            self.cell(0, 6, f"[Figure missing: {os.path.basename(path)}]", 0, 1)
            self.ln(2)

pdf = Report()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()

# Title
pdf.set_font("Helvetica", "B", 18)
pdf.cell(0, 12, "Muon3 Simulation Report", 0, 1, "C")
pdf.set_font("Helvetica", "", 11)
pdf.cell(0, 6, "P0 Architecture Baseline | Four-Channel Cosmic Muon Telescope", 0, 1, "C")
pdf.ln(4)

pdf.chapter_title("1. Analog Front-End (ngspice)")

pdf.body("DC-coupled MicroFC-30035 SiPM into OPA858 TIA (Rf=2 kOhm, Cf=2.2 pF) followed by dual TLV3601 comparators. Synthetic but physics-matched waveforms were generated matching expected behavior from the netlist.")

pdf.add_image_safe(os.path.join(FIGS, "muon3_pulse_family.png"), w=175)
pdf.add_image_safe(os.path.join(FIGS, "muon3_tot_vs_npe.png"), w=150)

pdf.chapter_title("2. Detector (Geant4 stand-in)")

pdf.body("Light yield, position dependence, and photon arrival statistics for 200x200x10 mm panel + WLS loop fiber.")
pdf.add_image_safe(os.path.join(FIGS, "yield_map.png"), w=150)
pdf.add_image_safe(os.path.join(FIGS, "pe_spectrum.png"), w=140)

pdf.chapter_title("3. System Models")

pdf.add_image_safe(os.path.join(FIGS, "power_budget_modes.png"), w=170)
pdf.add_image_safe(os.path.join(FIGS, "thermal_step.png"), w=165)

pdf.chapter_title("Key Numbers (example - calibrate with data)")

pdf.set_font("Helvetica", "", 10)
pdf.set_fill_color(245, 245, 245)
pdf.cell(0, 6, "- Typical MIP detected: 25-40 p.e. after all losses", 0, 1, "L", True)
pdf.cell(0, 6, "- 3 p.e. threshold gives >98% muon efficiency with low accidentals", 0, 1, "L", True)
pdf.cell(0, 6, "- 5 V fallback power: ~1.75-2.5 W (cooling disabled, science valid)", 0, 1, "L", True)
pdf.cell(0, 6, "- Full cooling (4x TEC + fans @12-20 V): 28-37 W", 0, 1, "L", True)
pdf.ln(4)

pdf.chapter_title("Files & Reproducibility")
pdf.body("""All source models, CSVs, and figures are in sim/.
LaTeX source: sim/reports/muon3_simulation_report.tex (compile with pdflatex after real data integration).
Run scripts:
  circuit: ./run_sweeps.sh ; python analyze...
  python: python python/*.py
  geant4: (real) mkdir build; cmake ..; make ; ./muon_panel""")

pdf.output(OUT)
print(f"PDF report written: {OUT}")
print("Also see the .tex source for full LaTeX version.")
