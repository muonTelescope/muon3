// HcalTileDetectorConstruction.cc
// Build sPHENIX Inner HCal tile assemblies without GDML (Geant4 may be built
// without GDML support). Geometry is loaded from mesh JSON exported from the
// original tile GDMLs, plus parametric fiber / coating / wrap / blocker / SiPM.

#include "HcalTileDetectorConstruction.hh"
#include "PanelSensitiveDetector.hh"

#include "G4NistManager.hh"
#include "G4Box.hh"
#include "G4Tubs.hh"
#include "G4SubtractionSolid.hh"
#include "G4TessellatedSolid.hh"
#include "G4TriangularFacet.hh"
#include "G4LogicalVolume.hh"
#include "G4LogicalVolumeStore.hh"
#include "G4PVPlacement.hh"
#include "G4Material.hh"
#include "G4MaterialPropertiesTable.hh"
#include "G4OpticalSurface.hh"
#include "G4LogicalSkinSurface.hh"
#include "G4SDManager.hh"
#include "G4SystemOfUnits.hh"
#include "G4VisAttributes.hh"
#include "G4Colour.hh"
#include "G4RotationMatrix.hh"
#include "G4ThreeVector.hh"
#include "G4Exception.hh"

#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <cmath>

namespace {

// Minimal JSON helpers (geometry files are simple, machine-written).
std::string ReadFile(const std::string& path) {
  std::ifstream in(path);
  if (!in) return {};
  std::ostringstream ss;
  ss << in.rdbuf();
  return ss.str();
}

// Extract first array of numbers after key "key":
std::vector<double> ExtractNumberArray(const std::string& s, const std::string& key) {
  auto pos = s.find("\"" + key + "\"");
  if (pos == std::string::npos) return {};
  pos = s.find('[', pos);
  if (pos == std::string::npos) return {};
  std::vector<double> out;
  // Walk until matching close at top level for this array — but arrays can nest.
  // For vertices_mm: [[x,y,z],...]; for faces: [[i,j,k],...]
  // We'll parse flattened by collecting all numbers until the section ends at the
  // matching bracket depth returning to the key array's close.
  int depth = 0;
  std::string num;
  auto flush = [&]() {
    if (!num.empty()) {
      out.push_back(std::stod(num));
      num.clear();
    }
  };
  for (size_t i = pos; i < s.size(); ++i) {
    char c = s[i];
    if (c == '[') {
      depth++;
      continue;
    }
    if (c == ']') {
      flush();
      depth--;
      if (depth == 0) break;
      continue;
    }
    if (depth >= 1 && (std::isdigit(c) || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E')) {
      num.push_back(c);
    } else {
      flush();
    }
  }
  return out;
}

double ExtractNumber(const std::string& s, const std::string& key, double def = 0.) {
  auto pos = s.find("\"" + key + "\"");
  if (pos == std::string::npos) return def;
  pos = s.find(':', pos);
  if (pos == std::string::npos) return def;
  size_t i = pos + 1;
  while (i < s.size() && (s[i] == ' ' || s[i] == '\t')) ++i;
  try {
    return std::stod(s.substr(i));
  } catch (...) {
    return def;
  }
}

struct FiberPt { double x, y; };

std::vector<FiberPt> ExtractFiberPath(const std::string& s) {
  auto nums = ExtractNumberArray(s, "fiber_path_xy");
  std::vector<FiberPt> pts;
  for (size_t i = 0; i + 1 < nums.size(); i += 2) {
    pts.push_back({nums[i], nums[i + 1]});
  }
  return pts;
}

}  // namespace

HcalTileDetectorConstruction::HcalTileDetectorConstruction(const G4String& gdmlPath)
  : fGdmlPath(gdmlPath) {}

HcalTileDetectorConstruction::~HcalTileDetectorConstruction() {
  delete fReflectorSurf;
}

G4VPhysicalVolume* HcalTileDetectorConstruction::Construct() {
  // Resolve mesh JSON: accept either assembly gdml path or mesh json path.
  G4String meshPath = fGdmlPath;
  if (meshPath.find("_mesh.json") == std::string::npos) {
    // e.g. gdml/InnerHCalTile01_EJ200_assembly.gdml -> gdml/mesh/InnerHCalTile01_EJ200_mesh.json
    G4String base = meshPath;
    auto slash = base.find_last_of("/\\");
    G4String file = (slash == std::string::npos) ? base : base.substr(slash + 1);
    auto und = file.find("_assembly");
    if (und != std::string::npos) file = file.substr(0, und);
    auto dot = file.find(".gdml");
    if (dot != std::string::npos) file = file.substr(0, dot);
    // Prefer mesh next to gdml
    meshPath = "gdml/mesh/" + file + "_mesh.json";
  }

  std::string json = ReadFile(meshPath);
  if (json.empty()) {
    // Try source-tree relative path from build dir
    meshPath = "../gdml/mesh/" + meshPath.substr(meshPath.find_last_of("/\\") + 1);
    // If still looking wrong, reconstruct
    if (json.empty()) {
      // from fGdmlPath basename
      G4String file = fGdmlPath;
      auto slash = file.find_last_of("/\\");
      if (slash != std::string::npos) file = file.substr(slash + 1);
      auto und = file.find("_assembly");
      if (und != std::string::npos) file = file.substr(0, und);
      auto dot = file.find('.');
      if (dot != std::string::npos) file = file.substr(0, dot);
      meshPath = "../gdml/mesh/" + file + "_mesh.json";
      json = ReadFile(meshPath);
    }
  }
  if (json.empty()) {
    G4ExceptionDescription ed;
    ed << "Cannot open mesh JSON for tile (tried path derived from " << fGdmlPath << ")";
    G4Exception("HcalTileDetectorConstruction::Construct", "HCal010", FatalException, ed);
  }

  auto vertsFlat = ExtractNumberArray(json, "vertices_mm");
  auto facesFlat = ExtractNumberArray(json, "faces");
  if (vertsFlat.size() < 9 || facesFlat.size() < 3) {
    G4Exception("HcalTileDetectorConstruction::Construct", "HCal011", FatalException,
                "Mesh JSON missing vertices/faces.");
  }

  std::vector<G4ThreeVector> verts;
  for (size_t i = 0; i + 2 < vertsFlat.size(); i += 3) {
    verts.emplace_back(vertsFlat[i] * mm, vertsFlat[i + 1] * mm, vertsFlat[i + 2] * mm);
  }
  auto fiberPath = ExtractFiberPath(json);
  double z_mid = ExtractNumber(json, "z_mid_mm", 0.0) * mm;
  double fiber_r = ExtractNumber(json, "fiber_radius_mm", 0.5) * mm;
  double clad_r = ExtractNumber(json, "clad_outer_mm", 0.6) * mm;
  double coat_t = ExtractNumber(json, "coating_thickness_mm", 0.1) * mm;
  double wrap_t = ExtractNumber(json, "wrap_thickness_mm", 0.2) * mm;
  double xmin = ExtractNumber(json, "xmin", 0) * mm;
  double xmax = ExtractNumber(json, "xmax", 120) * mm;
  double ymin = ExtractNumber(json, "ymin", 0) * mm;
  double ymax = ExtractNumber(json, "ymax", 191) * mm;
  double zmin = ExtractNumber(json, "zmin", -3.5) * mm;
  double zmax = ExtractNumber(json, "zmax", 3.5) * mm;
  // blocker
  double bcx = ExtractNumber(json, "\"cx\"", 0);  // fragile — parse blocker block manually below
  // Better: search within "blocker"
  auto bpos = json.find("\"blocker\"");
  double bx = 60 * mm, by = 194 * mm, bz = z_mid, bsx = 20 * mm, bsy = 6 * mm, bsz = 8 * mm;
  double sx = 60 * mm, sy = 197 * mm, sz = z_mid, ssx = 3 * mm, ssy = 0.5 * mm, ssz = 3 * mm;
  if (bpos != std::string::npos) {
    auto sub = json.substr(bpos, 400);
    bx = ExtractNumber(sub, "cx", 60) * mm;
    by = ExtractNumber(sub, "cy", 194) * mm;
    bz = ExtractNumber(sub, "cz", 0) * mm;
    bsx = ExtractNumber(sub, "sx", 20) * mm;
    bsy = ExtractNumber(sub, "sy", 6) * mm;
    bsz = ExtractNumber(sub, "sz", 8) * mm;
  }
  auto spos = json.find("\"sipm\"");
  if (spos != std::string::npos) {
    auto sub = json.substr(spos, 400);
    sx = ExtractNumber(sub, "cx", 60) * mm;
    sy = ExtractNumber(sub, "cy", 197) * mm;
    sz = ExtractNumber(sub, "cz", 0) * mm;
    ssx = ExtractNumber(sub, "sx", 3) * mm;
    ssy = ExtractNumber(sub, "sy", 0.5) * mm;
    ssz = ExtractNumber(sub, "sz", 3) * mm;
  }
  (void)bcx;

  // ---- Materials ----
  auto* nist = G4NistManager::Instance();
  auto* air = nist->FindOrBuildMaterial("G4_AIR");
  auto* si = nist->FindOrBuildMaterial("G4_Si");

  auto* ej200 = new G4Material("EJ200", 1.023 * g / cm3, 2);
  ej200->AddElement(nist->FindOrBuildElement("H"), 0.5243);
  ej200->AddElement(nist->FindOrBuildElement("C"), 0.4757);

  auto* wlsCore = new G4Material("WLS_Core", 1.19 * g / cm3, 3);
  wlsCore->AddElement(nist->FindOrBuildElement("C"), 5);
  wlsCore->AddElement(nist->FindOrBuildElement("H"), 8);
  wlsCore->AddElement(nist->FindOrBuildElement("O"), 2);

  auto* wlsClad = new G4Material("WLS_Clad", 1.40 * g / cm3, 2);
  wlsClad->AddElement(nist->FindOrBuildElement("C"), 2);
  wlsClad->AddElement(nist->FindOrBuildElement("F"), 4);

  auto* absPlastic = new G4Material("ABS_Plastic", 1.05 * g / cm3, 2);
  absPlastic->AddElement(nist->FindOrBuildElement("C"), 8);
  absPlastic->AddElement(nist->FindOrBuildElement("H"), 8);

  auto* coating = new G4Material("DiffuseCoating", 1.2 * g / cm3, 2);
  coating->AddElement(nist->FindOrBuildElement("C"), 1);
  coating->AddElement(nist->FindOrBuildElement("H"), 1);

  auto* wrapMat = new G4Material("LightTightWrap", 1.1 * g / cm3, 2);
  wrapMat->AddElement(nist->FindOrBuildElement("C"), 1);
  wrapMat->AddElement(nist->FindOrBuildElement("H"), 1);

  // Optical material properties (materials exist by name now)
  AttachOpticalProperties();

  // ---- World ----
  // Tile solids use absolute GDML coordinates (not centered at origin). Size the
  // world so all daughters (fiber exit, light blocker, SiPM) fit with margin.
  G4double xlo = std::min(xmin, sx) - 100 * mm;
  G4double xhi = std::max(xmax, sx) + 100 * mm;
  G4double ylo = std::min(ymin, sy) - 100 * mm;
  G4double yhi = std::max(ymax, sy) + 150 * mm;  // SiPM sits beyond outer radius
  G4double zlo = std::min(zmin, sz) - 100 * mm;
  G4double zhi = std::max(zmax, sz) + 100 * mm;
  G4ThreeVector worldCenter(0.5 * (xlo + xhi), 0.5 * (ylo + yhi), 0.5 * (zlo + zhi));
  G4double hxw = 0.5 * (xhi - xlo);
  G4double hyw = 0.5 * (yhi - ylo);
  G4double hzw = 0.5 * (zhi - zlo);
  auto* worldSolid = new G4Box("World", hxw, hyw, hzw);
  auto* worldLV = new G4LogicalVolume(worldSolid, air, "WorldLV");
  // Place world box so its local origin coincides with global origin: the solid
  // is centered at worldCenter in global coords via the placement below.
  // Simpler: keep world solid large and centered on origin covering [xlo,xhi]...
  // Use a world solid large enough centered at origin:
  G4double maxAbsX = std::max(std::abs(xlo), std::abs(xhi)) + 50 * mm;
  G4double maxAbsY = std::max(std::abs(ylo), std::abs(yhi)) + 50 * mm;
  G4double maxAbsZ = std::max(std::abs(zlo), std::abs(zhi)) + 50 * mm;
  delete worldSolid;
  worldSolid = new G4Box("World", maxAbsX, maxAbsY, maxAbsZ);
  worldLV = new G4LogicalVolume(worldSolid, air, "WorldLV");
  auto* worldPV = new G4PVPlacement(nullptr, G4ThreeVector(), worldLV, "World", nullptr, false, 0);
  (void)worldCenter;
  (void)hxw;
  (void)hyw;
  (void)hzw;

  // ---- Tessellated scintillator from original GDML mesh ----
  auto* tess = new G4TessellatedSolid("InnerHCalTile_EJ200-SOL");
  for (size_t i = 0; i + 2 < facesFlat.size(); i += 3) {
    int i0 = (int)facesFlat[i];
    int i1 = (int)facesFlat[i + 1];
    int i2 = (int)facesFlat[i + 2];
    if (i0 < 0 || i1 < 0 || i2 < 0 ||
        (size_t)i0 >= verts.size() || (size_t)i1 >= verts.size() || (size_t)i2 >= verts.size()) {
      continue;
    }
    auto* facet = new G4TriangularFacet(verts[i0], verts[i1], verts[i2], ABSOLUTE);
    tess->AddFacet((G4VFacet*)facet);
  }
  tess->SetSolidClosed(true);

  auto* scintLV = new G4LogicalVolume(tess, ej200, "InnerHCalTile_EJ200");
  new G4PVPlacement(nullptr, G4ThreeVector(), scintLV, "InnerHCalTile_EJ200", worldLV, false, 0);

  // ---- Fiber segments ----
  if (fiberPath.size() >= 2) {
    for (size_t i = 0; i + 1 < fiberPath.size(); ++i) {
      double x1 = fiberPath[i].x * mm, y1 = fiberPath[i].y * mm;
      double x2 = fiberPath[i + 1].x * mm, y2 = fiberPath[i + 1].y * mm;
      double dx = x2 - x1, dy = y2 - y1;
      double len = std::hypot(dx, dy);
      if (len < 0.5 * mm) continue;
      auto* coreSol = new G4Tubs("fcore", 0, fiber_r, 0.5 * len, 0, 360 * deg);
      auto* cladSol = new G4Tubs("fclad", fiber_r, clad_r, 0.5 * len, 0, 360 * deg);
      auto* coreLV = new G4LogicalVolume(coreSol, wlsCore, "fiber_core_seg");
      auto* cladLV = new G4LogicalVolume(cladSol, wlsClad, "fiber_clad_seg");
      // Rotate tube (local Z) into XY direction
      double az = std::atan2(dy, dx);
      auto* rot = new G4RotationMatrix();
      rot->rotateY(90 * deg);
      rot->rotateZ(az);
      G4ThreeVector pos(0.5 * (x1 + x2), 0.5 * (y1 + y2), z_mid);
      new G4PVPlacement(rot, pos, cladLV, "fiber_clad", worldLV, false, (G4int)i);
      new G4PVPlacement(rot, pos, coreLV, "fiber_core", worldLV, false, (G4int)i);
    }
  }

  // ---- Coating and wrap shells (bbox-based) ----
  G4double dx = xmax - xmin, dy = ymax - ymin, dz = zmax - zmin;
  G4ThreeVector c(0.5 * (xmin + xmax), 0.5 * (ymin + ymax), 0.5 * (zmin + zmax));
  auto* coatOuter = new G4Box("coatO", 0.5 * dx + coat_t, 0.5 * dy + coat_t, 0.5 * dz + coat_t);
  auto* coatInner = new G4Box("coatI", 0.5 * dx, 0.5 * dy, 0.5 * dz);
  auto* coatShell = new G4SubtractionSolid("CoatingShell", coatOuter, coatInner);
  auto* coatLV = new G4LogicalVolume(coatShell, coating, "DiffuseCoatingLV");
  new G4PVPlacement(nullptr, c, coatLV, "DiffuseCoating", worldLV, false, 0);

  auto* wrapOuter =
      new G4Box("wrapO", 0.5 * dx + coat_t + wrap_t, 0.5 * dy + coat_t + wrap_t, 0.5 * dz + coat_t + wrap_t);
  auto* wrapInner = new G4Box("wrapI", 0.5 * dx + coat_t, 0.5 * dy + coat_t, 0.5 * dz + coat_t);
  auto* wrapShell = new G4SubtractionSolid("WrapShell", wrapOuter, wrapInner);
  auto* wrapLV = new G4LogicalVolume(wrapShell, wrapMat, "LightTightWrapLV");
  new G4PVPlacement(nullptr, c, wrapLV, "LightTightWrap", worldLV, false, 0);

  // ---- Light blocker + Hamamatsu S12572-33-015P SiPM ----
  // Dual WLS fiber ends exit at the outer radius into a plastic coupler (light
  // blocker). An air gap (~0.75 mm, sPHENIX tile design) between the polished
  // fiber ends and the SiPM face spreads light over the 3×3 mm² active area and
  // reduces optical saturation (Aidala et al., IEEE TNS 2018).
  auto* blockLV =
      new G4LogicalVolume(new G4Box("BlockerBox", 0.5 * bsx, 0.5 * bsy, 0.5 * bsz), absPlastic, "LightBlockerLV");
  new G4PVPlacement(nullptr, G4ThreeVector(bx, by, bz), blockLV, "LightBlocker", worldLV, false, 0);

  // Prefer CAD/JSON placement; enforce nominal 3×3 mm active face and package depth.
  // ssy is the thickness along the fiber-exit axis (local Y in tile coords).
  G4double sipmFace = 3.0 * mm;   // S12572-33-015P active area 3×3 mm²
  G4double sipmDepth = 1.5 * mm;  // ceramic package depth (approx.)
  if (ssx < 2.5 * mm) ssx = sipmFace;
  if (ssz < 2.5 * mm) ssz = sipmFace;
  if (ssy < 0.4 * mm) ssy = sipmDepth;

  // Place SiPM so its entrance face is fAirGapMm beyond ymax (fiber exit plane).
  G4double airGap = fAirGapMm * mm;
  G4double sipmCy = ymax + airGap + 0.5 * ssy;
  // Keep JSON cx/cz if provided; override cy for consistent air-gap geometry.
  if (std::abs(sy) > 0.1 * mm) {
    // JSON already places beyond exit; still enforce minimum air gap from ymax
    if (sy - 0.5 * ssy < ymax + airGap) {
      sipmCy = ymax + airGap + 0.5 * ssy;
    } else {
      sipmCy = sy;
    }
  }
  sx = (std::abs(sx) > 0.1 * mm) ? sx : 0.5 * (xmin + xmax);
  sz = (std::abs(sz) > 0.1 * mm) ? sz : 0.5 * (zmin + zmax);

  auto* sipmLV = new G4LogicalVolume(new G4Box("SiPMBox", 0.5 * ssx, 0.5 * ssy, 0.5 * ssz), si, "SiPMLV");
  // Volume name encodes the Hamamatsu part for SD / debugging
  sipmLV->SetName("SiPMLV");  // keep SD attachment name stable
  new G4PVPlacement(nullptr, G4ThreeVector(sx, sipmCy, sz), sipmLV, "SiPM_S12572_015P", worldLV, false, 0);

  SetupSurfaces(worldPV);

  // Vis
  scintLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.15, 0.75, 0.25, 0.45)));
  coatLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.95, 0.95, 0.95, 0.2)));
  wrapLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.05, 0.05, 0.05, 0.3)));
  blockLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.2, 0.2, 0.25)));
  sipmLV->SetVisAttributes(new G4VisAttributes(G4Colour(0.85, 0.15, 0.1)));

  G4cout << "HcalTileDetectorConstruction: built tessellated tile from " << meshPath
         << "  verts=" << verts.size() << " faces=" << facesFlat.size() / 3
         << " fiberPts=" << fiberPath.size() << G4endl;
  G4cout << "  bbox mm: x=[" << xmin / mm << "," << xmax / mm << "] y=[" << ymin / mm << ","
         << ymax / mm << "] z=[" << zmin / mm << "," << zmax / mm << "]" << G4endl;
  G4cout << "  SiPM: " << kSipmPartNumber << "  active=" << ssx / mm << "x" << ssz / mm
         << " mm  PDE=" << fPDE << "  airGap=" << airGap / mm << " mm  y=" << sipmCy / mm << " mm"
         << G4endl;
  return worldPV;
}

void HcalTileDetectorConstruction::AttachOpticalProperties() {
  const G4int nBins = 6;
  G4double photonEnergy[nBins] = {2.5 * eV, 2.7 * eV, 2.9 * eV, 3.0 * eV, 3.1 * eV, 3.3 * eV};
  G4double fiberE[nBins] = {2.0 * eV, 2.3 * eV, 2.6 * eV, 2.9 * eV, 3.1 * eV, 3.4 * eV};

  if (auto* mat = G4Material::GetMaterial("EJ200", false)) {
    auto* mpt = new G4MaterialPropertiesTable();
    G4double scintComp[nBins] = {0.1, 0.6, 1.0, 0.7, 0.3, 0.05};
    G4double rindex[nBins] = {1.58, 1.58, 1.58, 1.58, 1.58, 1.58};
    G4double absLen[nBins] = {200. * cm, 200. * cm, 200. * cm, 200. * cm, 200. * cm, 200. * cm};
    mpt->AddProperty("FASTCOMPONENT", photonEnergy, scintComp, nBins, true);
    mpt->AddProperty("RINDEX", photonEnergy, rindex, nBins);
    mpt->AddProperty("ABSLENGTH", photonEnergy, absLen, nBins);
    mpt->AddConstProperty("SCINTILLATIONYIELD", fScintYield / MeV, true);
    mpt->AddConstProperty("RESOLUTIONSCALE", 1.0, true);
    mpt->AddConstProperty("FASTTIMECONSTANT", 2.1 * ns, true);
    mpt->AddConstProperty("YIELDRATIO", 1.0, true);
    mat->SetMaterialPropertiesTable(mpt);
  }

  if (auto* mat = G4Material::GetMaterial("WLS_Core", false)) {
    auto* mpt = new G4MaterialPropertiesTable();
    G4double fiberR[nBins] = {1.49, 1.49, 1.49, 1.49, 1.49, 1.49};
    G4double fiberAbs[nBins] = {3.5 * cm, 3.5 * cm, 0.5 * cm, 0.02 * cm, 0.01 * cm, 0.01 * cm};
    G4double fiberWLS[nBins] = {0.0, 0.1, 0.9, 1.0, 0.6, 0.1};
    mpt->AddProperty("RINDEX", fiberE, fiberR, nBins);
    mpt->AddProperty("ABSLENGTH", fiberE, fiberAbs, nBins);
    mpt->AddProperty("WLSABSLENGTH", fiberE, fiberAbs, nBins);
    mpt->AddProperty("WLSCOMPONENT", fiberE, fiberWLS, nBins);
    mpt->AddConstProperty("WLSTIMECONSTANT", 3.0 * ns, true);
    mpt->AddConstProperty("WLSMEANNUMBERPHOTONS", fWLSEff, true);
    mat->SetMaterialPropertiesTable(mpt);
  }

  if (auto* mat = G4Material::GetMaterial("WLS_Clad", false)) {
    auto* mpt = new G4MaterialPropertiesTable();
    G4double cladR[nBins] = {1.42, 1.42, 1.42, 1.42, 1.42, 1.42};
    G4double cladA[nBins] = {100. * cm, 100. * cm, 100. * cm, 100. * cm, 100. * cm, 100. * cm};
    mpt->AddProperty("RINDEX", fiberE, cladR, nBins);
    mpt->AddProperty("ABSLENGTH", fiberE, cladA, nBins);
    mat->SetMaterialPropertiesTable(mpt);
  }

  if (auto* mat = G4Material::GetMaterial("G4_AIR", false)) {
    auto* mpt = new G4MaterialPropertiesTable();
    G4double airR[nBins] = {1.0, 1.0, 1.0, 1.0, 1.0, 1.0};
    mpt->AddProperty("RINDEX", photonEnergy, airR, nBins);
    mat->SetMaterialPropertiesTable(mpt);
  }

  fReflectorSurf = new G4OpticalSurface("HCalReflector", unified, ground, dielectric_metal);
  auto* refMPT = new G4MaterialPropertiesTable();
  G4double refE[2] = {2.0 * eV, 3.5 * eV};
  G4double refR[2] = {0.96, 0.96};
  refMPT->AddProperty("REFLECTIVITY", refE, refR, 2);
  fReflectorSurf->SetMaterialPropertiesTable(refMPT);
}

void HcalTileDetectorConstruction::SetupSurfaces(G4VPhysicalVolume* /*world*/) {
  auto* absSurf = new G4OpticalSurface("HCalAbsorber", unified, ground, dielectric_metal);
  auto* absMPT = new G4MaterialPropertiesTable();
  G4double refE[2] = {2.0 * eV, 3.5 * eV};
  G4double absR[2] = {0.05, 0.05};
  absMPT->AddProperty("REFLECTIVITY", refE, absR, 2);
  absSurf->SetMaterialPropertiesTable(absMPT);

  for (auto* lv : *G4LogicalVolumeStore::GetInstance()) {
    const G4String& n = lv->GetName();
    if (n.find("DiffuseCoating") != std::string::npos ||
        n.find("InnerHCal") != std::string::npos) {
      new G4LogicalSkinSurface(n + "_refl", lv, fReflectorSurf);
    }
    if (n.find("LightTight") != std::string::npos || n.find("LightBlocker") != std::string::npos) {
      new G4LogicalSkinSurface(n + "_abs", lv, absSurf);
    }
  }
}

void HcalTileDetectorConstruction::ConstructSDandField() {
  auto* sdManager = G4SDManager::GetSDMpointer();
  // Hamamatsu S12572-33-015P PDE (~25%); distinct from Muon3 MicroFC-30035.
  auto* sipmSD = new PanelSensitiveDetector("HCal_SiPM_SD", nullptr, fPDE);
  sdManager->AddNewDetector(sipmSD);
  if (auto* lv = G4LogicalVolumeStore::GetInstance()->GetVolume("SiPMLV", false)) {
    lv->SetSensitiveDetector(sipmSD);
  }

  auto* scintSD = new PanelSensitiveDetector("HCal_Scint_SD", nullptr);
  sdManager->AddNewDetector(scintSD);
  for (auto* lv : *G4LogicalVolumeStore::GetInstance()) {
    if (lv->GetName().find("InnerHCal") != std::string::npos) {
      lv->SetSensitiveDetector(scintSD);
    }
  }
}
