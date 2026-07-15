#!/usr/bin/env python3
"""Build complete Inner HCal tile assembly GDMLs for Geant4.

Each assembly GDML includes:
  - materials (EJ200, WLS core/clad, air, Si, ABS plastic, TiO2 coating)
  - original tessellated scintillator solid (copied from upstream GDML)
  - fiber segments (tubes along the serpentine path)
  - diffuse coating box shell (approximated)
  - light-tight wrap
  - light blocker / SiPM coupler
  - SiPM volume
  - world volume enclosing the assembly

Original tile GDMLs are never modified; assemblies are written to sim/geant4/gdml/.
"""
from __future__ import annotations

import json
import math
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Tuple

ROOT = Path(__file__).resolve().parents[3]


def materials_block() -> str:
    return """  <materials>
    <element name="H" formula="H" Z="1"><atom value="1.0079"/></element>
    <element name="C" formula="C" Z="6"><atom value="12.0107"/></element>
    <element name="N" formula="N" Z="7"><atom value="14.0067"/></element>
    <element name="O" formula="O" Z="8"><atom value="15.999"/></element>
    <element name="Si" formula="Si" Z="14"><atom value="28.0855"/></element>
    <element name="Ti" formula="Ti" Z="22"><atom value="47.867"/></element>
    <element name="F" formula="F" Z="9"><atom value="18.998"/></element>

    <material name="G4_AIR" state="gas">
      <D value="0.00120479" unit="g/cm3"/>
      <fraction n="0.7" ref="N"/>
      <fraction n="0.3" ref="O"/>
    </material>

    <!-- EJ-200 equivalent (sPHENIX HCal scintillator / Muon3 panels) -->
    <material name="EJ200" state="solid">
      <D value="1.023" unit="g/cm3"/>
      <fraction n="0.5243" ref="H"/>
      <fraction n="0.4757" ref="C"/>
    </material>

    <!-- Kuraray Y-11-like WLS core (PMMA) -->
    <material name="WLS_Core" state="solid">
      <D value="1.19" unit="g/cm3"/>
      <fraction n="0.0805" ref="H"/>
      <fraction n="0.5998" ref="C"/>
      <fraction n="0.3197" ref="O"/>
    </material>

    <material name="WLS_Clad" state="solid">
      <D value="1.43" unit="g/cm3"/>
      <fraction n="0.2402" ref="C"/>
      <fraction n="0.7598" ref="F"/>
    </material>

    <material name="Silicon" state="solid">
      <D value="2.33" unit="g/cm3"/>
      <composite n="1" ref="Si"/>
    </material>

    <!-- Plastic coupler / light blocker (ABS-like) -->
    <material name="ABS_Plastic" state="solid">
      <D value="1.05" unit="g/cm3"/>
      <fraction n="0.077" ref="H"/>
      <fraction n="0.853" ref="C"/>
      <fraction n="0.070" ref="N"/>
    </material>

    <!-- White diffuse coating (TiO2-loaded polystyrene approximation) -->
    <material name="DiffuseCoating" state="solid">
      <D value="1.2" unit="g/cm3"/>
      <fraction n="0.50" ref="C"/>
      <fraction n="0.08" ref="H"/>
      <fraction n="0.30" ref="O"/>
      <fraction n="0.12" ref="Ti"/>
    </material>

    <!-- Black light-tight wrap -->
    <material name="LightTightWrap" state="solid">
      <D value="1.1" unit="g/cm3"/>
      <fraction n="0.08" ref="H"/>
      <fraction n="0.92" ref="C"/>
    </material>
  </materials>
"""


def extract_define_and_solid(gdml_path: Path) -> Tuple[str, str, str]:
    """Return (define_xml, solid_xml, volume_name) from original tile GDML."""
    text = gdml_path.read_text()
    # Extract define block
    d0 = text.find("<define>")
    d1 = text.find("</define>") + len("</define>")
    define_xml = text[d0:d1]

    s0 = text.find("<solids>")
    s1 = text.find("</solids>") + len("</solids>")
    solids_xml = text[s0:s1]
    # strip outer solids tags — we'll re-wrap
    inner_solid = text[s0 + len("<solids>") : text.find("</solids>")].strip()

    # volume name
    import re

    m = re.search(r'<volume name="([^"]+)"', text)
    vol = m.group(1) if m else gdml_path.stem
    return define_xml, inner_solid, vol


def fiber_tubes_xml(
    path_xy: List[List[float]], z: float, r_core: float, r_clad: float
) -> Tuple[str, str, str, str]:
    """Generate define extras, solids, volume defs, and physvols for fiber segments."""
    solids: List[str] = []
    physvols: List[str] = []
    define_extra: List[str] = []
    vol_defs: List[str] = []

    cleaned = [path_xy[0]]
    for p in path_xy[1:]:
        if math.hypot(p[0] - cleaned[-1][0], p[1] - cleaned[-1][1]) > 0.5:
            cleaned.append(p)

    seg = 0
    for a, b in zip(cleaned[:-1], cleaned[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        if length < 0.5:
            continue
        # Tube local axis = Z. rotY(90) maps +Z -> +X; rotZ(az) aims in XY.
        az = math.degrees(math.atan2(dy, dx))
        cx = 0.5 * (a[0] + b[0])
        cy = 0.5 * (a[1] + b[1])
        cz = z
        name_c = f"fiber_core_seg{seg}"
        name_cl = f"fiber_clad_seg{seg}"
        solids.append(
            f'    <tube name="{name_c}-SOL" rmin="0" rmax="{r_core}" z="{length:.4f}" '
            f'startphi="0" deltaphi="360" aunit="deg" lunit="mm"/>'
        )
        solids.append(
            f'    <tube name="{name_cl}-SOL" rmin="{r_core}" rmax="{r_clad}" z="{length:.4f}" '
            f'startphi="0" deltaphi="360" aunit="deg" lunit="mm"/>'
        )
        define_extra.append(
            f'    <position name="{name_c}_pos" unit="mm" x="{cx:.4f}" y="{cy:.4f}" z="{cz:.4f}"/>'
        )
        define_extra.append(
            f'    <rotation name="{name_c}_rot" unit="deg" x="0" y="90" z="{az:.4f}"/>'
        )
        vol_defs.append(
            f"""    <volume name="{name_c}">
      <materialref ref="WLS_Core"/>
      <solidref ref="{name_c}-SOL"/>
    </volume>
    <volume name="{name_cl}">
      <materialref ref="WLS_Clad"/>
      <solidref ref="{name_cl}-SOL"/>
    </volume>"""
        )
        physvols.append(
            f"""      <physvol name="{name_cl}_pv">
        <volumeref ref="{name_cl}"/>
        <positionref ref="{name_c}_pos"/>
        <rotationref ref="{name_c}_rot"/>
      </physvol>
      <physvol name="{name_c}_pv">
        <volumeref ref="{name_c}"/>
        <positionref ref="{name_c}_pos"/>
        <rotationref ref="{name_c}_rot"/>
      </physvol>"""
        )
        seg += 1

    return (
        "\n".join(define_extra),
        "\n".join(solids),
        "\n".join(vol_defs),
        "\n".join(physvols),
    )


def build_assembly(name: str, params: dict, src_gdml: Path, out_path: Path):
    define_xml, solid_inner, scint_vol = extract_define_and_solid(src_gdml)
    # rename define block content only
    define_body = define_xml.replace("<define>", "").replace("</define>", "").strip()

    z = params["z_mid_mm"]
    r_core = params["fiber_radius_mm"]
    r_clad = params["clad_outer_mm"]
    fib_def, fib_sol, fib_vol, fib_phys = fiber_tubes_xml(
        params["fiber_path_xy"], z, r_core, r_clad
    )

    bb = params["bbox"]
    coat_t = params["coating_thickness_mm"]
    wrap_t = params["wrap_thickness_mm"]
    b = params["blocker"]
    s = params["sipm"]

    # World large enough
    wx = bb["dx"] + 80
    wy = bb["dy"] + 80
    wz = bb["dz"] + 40
    cx = 0.5 * (bb["xmin"] + bb["xmax"])
    cy = 0.5 * (bb["ymin"] + bb["ymax"])
    cz = z

    gdml = f"""<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!--
  Assembly GDML for {name}: original tessellated scintillator + WLS fiber
  + diffuse coating + light-tight wrap + light blocker/coupler + SiPM.

  Original scintillator solid copied from:
    {src_gdml}

  Generated by cad/sphenix_hcal/scripts/build_assembly_gdml.py
  DO NOT edit by hand; regenerate from originals.
-->
<gdml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="http://service-spi.web.cern.ch/service-spi/app/releases/GDML/schema/gdml.xsd">

  <define>
{define_body}
{fib_def}
    <position name="world_origin" unit="mm" x="0" y="0" z="0"/>
    <position name="coating_pos" unit="mm" x="{cx}" y="{cy}" z="{cz}"/>
    <position name="wrap_pos" unit="mm" x="{cx}" y="{cy}" z="{cz}"/>
    <position name="blocker_pos" unit="mm" x="{b['cx']}" y="{b['cy']}" z="{b['cz']}"/>
    <position name="sipm_pos" unit="mm" x="{s['cx']}" y="{s['cy']}" z="{s['cz']}"/>
  </define>

{materials_block()}

  <solids>
{solid_inner}
{fib_sol}
    <box name="CoatingBox" lunit="mm" x="{bb['dx']+2*coat_t}" y="{bb['dy']+2*coat_t}" z="{bb['dz']+2*coat_t}"/>
    <box name="CoatingInner" lunit="mm" x="{bb['dx']}" y="{bb['dy']}" z="{bb['dz']}"/>
    <subtraction name="CoatingShell">
      <first ref="CoatingBox"/>
      <second ref="CoatingInner"/>
    </subtraction>
    <box name="WrapBox" lunit="mm" x="{bb['dx']+2*(coat_t+wrap_t)}" y="{bb['dy']+2*(coat_t+wrap_t)}" z="{bb['dz']+2*(coat_t+wrap_t)}"/>
    <box name="WrapInner" lunit="mm" x="{bb['dx']+2*coat_t}" y="{bb['dy']+2*coat_t}" z="{bb['dz']+2*coat_t}"/>
    <subtraction name="WrapShell">
      <first ref="WrapBox"/>
      <second ref="WrapInner"/>
    </subtraction>
    <box name="BlockerBox" lunit="mm" x="{b['sx']}" y="{b['sy']}" z="{b['sz']}"/>
    <box name="SiPMBox" lunit="mm" x="{s['sx']}" y="{s['sy']}" z="{s['sz']}"/>
    <box name="WorldBox" lunit="mm" x="{wx}" y="{wy}" z="{wz}"/>
  </solids>

  <structure>
    <volume name="{scint_vol}">
      <materialref ref="EJ200"/>
      <solidref ref="{scint_vol}-SOL"/>
    </volume>
{fib_vol}
    <volume name="DiffuseCoatingLV">
      <materialref ref="DiffuseCoating"/>
      <solidref ref="CoatingShell"/>
    </volume>
    <volume name="LightTightWrapLV">
      <materialref ref="LightTightWrap"/>
      <solidref ref="WrapShell"/>
    </volume>
    <volume name="LightBlockerLV">
      <materialref ref="ABS_Plastic"/>
      <solidref ref="BlockerBox"/>
    </volume>
    <volume name="SiPMLV">
      <materialref ref="Silicon"/>
      <solidref ref="SiPMBox"/>
    </volume>

    <volume name="World">
      <materialref ref="G4_AIR"/>
      <solidref ref="WorldBox"/>
      <physvol name="scint_pv">
        <volumeref ref="{scint_vol}"/>
        <positionref ref="world_origin"/>
      </physvol>
{fib_phys}
      <physvol name="coating_pv">
        <volumeref ref="DiffuseCoatingLV"/>
        <positionref ref="coating_pos"/>
      </physvol>
      <physvol name="wrap_pv">
        <volumeref ref="LightTightWrapLV"/>
        <positionref ref="wrap_pos"/>
      </physvol>
      <physvol name="blocker_pv">
        <volumeref ref="LightBlockerLV"/>
        <positionref ref="blocker_pos"/>
      </physvol>
      <physvol name="sipm_pv">
        <volumeref ref="SiPMLV"/>
        <positionref ref="sipm_pos"/>
      </physvol>
    </volume>
  </structure>

  <setup name="Default" version="1.0">
    <world ref="World"/>
  </setup>
</gdml>
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(gdml)
    print(f"Wrote {out_path}")


def main():
    params_path = ROOT / "cad/sphenix_hcal/tile_params.json"
    if not params_path.exists():
        import subprocess
        import sys

        subprocess.check_call(
            [
                sys.executable,
                str(ROOT / "cad/sphenix_hcal/scripts/parse_inner_tile.py"),
                "--gdml-dir",
                str(ROOT / "reference_documentation/repositories/sPHENIX_HCal/gdml"),
                "--out",
                str(params_path),
            ]
        )
    params_all = json.loads(params_path.read_text())
    src_dir = ROOT / "reference_documentation/repositories/sPHENIX_HCal/gdml"
    out_dir = ROOT / "sim/geant4/gdml"
    # Keep originals also mirrored next to assemblies
    orig_mirror = out_dir / "originals"
    orig_mirror.mkdir(parents=True, exist_ok=True)

    for name, params in sorted(params_all.items()):
        src = src_dir / f"{name}.gdml"
        shutil.copy2(src, orig_mirror / src.name)
        build_assembly(name, params, src, out_dir / f"{name}_assembly.gdml")

    print(f"Assemblies in {out_dir}; original tiles mirrored to {orig_mirror}")


if __name__ == "__main__":
    main()
