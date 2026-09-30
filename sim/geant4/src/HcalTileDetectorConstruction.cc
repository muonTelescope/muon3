// HcalTileDetectorConstruction.cc
// Build sPHENIX Inner HCal tile assemblies without GDML (Geant4 may be built
// without GDML support). Geometry is loaded from mesh JSON exported from the
// original tile GDMLs, plus parametric fiber / coating / wrap / blocker / SiPM.

#include "HcalTileDetectorConstruction.hh"
#include "PanelSensitiveDetector.hh"

#include "G4NistManager.hh"
#include "G4Box.hh"
#include "G4Tubs.hh"
#include "G4CutTubs.hh"
#include "G4ExtrudedSolid.hh"
#include "G4TwoVector.hh"
#include <algorithm>
#include "G4VSolid.hh"
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
#include "G4LogicalBorderSurface.hh"
#include "G4Version.hh"

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

double sipmDepthFor(double ssy) { return ssy < 0.4 * CLHEP::mm ? 1.5 * CLHEP::mm : ssy; }

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
  // Published tile construction (Aidala et al., IEEE TNS 65 (2018) 2901, Table II; sPHENIX TDR 2019):
  //   single-clad Kuraray Y11(200) K-27 S-type, 1.00 mm OD: PS core, PMMA cladding 2% of the diameter;
  //   fiber glued in its groove with EPO-TEK 301; 50 um solvent-developed reflective coating;
  //   wrap = 100 um Al foil + 30 um cling film + 100 um black vinyl.
  (void)ExtractNumber(json, "fiber_radius_mm", 0.5);   // mesh-JSON values predate these facts: not used
  const double clad_r = 0.50 * mm, fiber_r = 0.49 * mm, groove_r = 0.65 * mm;
  const double coat_t = 0.050 * mm, foil_t = 0.100 * mm, cling_t = 0.030 * mm, vinyl_t = 0.100 * mm;
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

  // Extruded polystyrene + 1.5% PTP + 0.01% POPOP (dopants are optical only: bulk = polystyrene)
  auto* polystyrene = nist->FindOrBuildMaterial("G4_POLYSTYRENE");
  auto* scintMat = new G4Material("PS_PTP_POPOP", 1.05 * g / cm3, 1);
  scintMat->AddMaterial(polystyrene, 1.0);

  auto* wlsCore = new G4Material("Y11_Core_PS", 1.05 * g / cm3, 1);         // polystyrene, n 1.59
  wlsCore->AddMaterial(polystyrene, 1.0);
  auto* wlsClad = new G4Material("Y11_Clad_PMMA", 1.19 * g / cm3, 1);       // PMMA, n 1.49
  wlsClad->AddMaterial(nist->FindOrBuildMaterial("G4_PLEXIGLASS"), 1.0);
  auto* epoxy = new G4Material("EPOTEK301", 1.16 * g / cm3, 3);              // bisphenol-A epoxy, n 1.52
  epoxy->AddElement(nist->FindOrBuildElement("C"), 0.72);
  epoxy->AddElement(nist->FindOrBuildElement("H"), 0.07);
  epoxy->AddElement(nist->FindOrBuildElement("O"), 0.21);
  auto* foil = nist->FindOrBuildMaterial("G4_Al");
  auto* cling = nist->FindOrBuildMaterial("G4_POLYETHYLENE");
  auto* vinyl = nist->FindOrBuildMaterial("G4_POLYVINYL_CHLORIDE");

  auto* absPlastic = new G4Material("ABS_Plastic", 1.05 * g / cm3, 2);
  absPlastic->AddElement(nist->FindOrBuildElement("C"), 8);
  absPlastic->AddElement(nist->FindOrBuildElement("H"), 8);

  auto* coating = new G4Material("DiffuseCoating", 1.30 * g / cm3, 2);     // TiO2-loaded polystyrene skin
  coating->AddMaterial(polystyrene, 0.85);
  coating->AddMaterial(nist->FindOrBuildMaterial("G4_TITANIUM_DIOXIDE"), 0.15);

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

  // ---- Scintillator ----
  // The mesh has a 71 x 8.7 mm connector pocket in the SiPM edge. The fibers cross its boundary at an oblique angle where
  // their bend begins, and a G4 volume cannot straddle a boundary, so by default the pocket is filled (an extruded hull):
  // the fibers then end flush with the tile edge, facing the coupler cavity. HCAL_POCKET=1 restores the mesh.
  G4VSolid* tileSolid = nullptr;
  std::vector<G4TwoVector> hullPoly;                // outline of the extruded tile (empty with HCAL_POCKET)
  if (std::getenv("HCAL_POCKET")) {
  auto* tess = new G4TessellatedSolid("InnerHCalTile_PS-SOL");
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

    tileSolid = tess;
  } else {
    auto hull = ExtractNumberArray(json, "hull_xy");
    std::vector<G4TwoVector> poly;
    for (size_t i = 0; i + 1 < hull.size(); i += 2) poly.emplace_back(hull[i] * mm, hull[i + 1] * mm);
    double area = 0;
    for (size_t i = 0; i < poly.size(); ++i) { const auto& p = poly[i]; const auto& q = poly[(i + 1) % poly.size()]; area += p.x() * q.y() - q.x() * p.y(); }
    if (area > 0) std::reverse(poly.begin(), poly.end());                     // G4ExtrudedSolid wants clockwise
    hullPoly = poly;
    tileSolid = new G4ExtrudedSolid("InnerHCalTile_PS-SOL", poly, 0.5 * (zmax - zmin), {0, 0}, 1, {0, 0}, 1);
  }
  auto* scintLV = new G4LogicalVolume(tileSolid, scintMat, "InnerHCalTile_PS");
  auto* scintPV = new G4PVPlacement(nullptr, G4ThreeVector(0, 0, std::getenv("HCAL_POCKET") ? 0.0 : z_mid), scintLV, "InnerHCalTile_PS", worldLV, false, 0);

  // ---- Fiber: epoxy-filled groove > PMMA cladding > PS core, nested INSIDE the tile ----
  // ONE closed loop (cad/sphenix_hcal/scripts/fiber_loop.py, after Aidala et al. 2018 Fig. 6): both ends leave the SiPM edge
  // side by side, two S-bends (R >= 25 mm) lead to two parallel legs, a semicircle closes the loop near the far edge. The JSON
  // holds the centre line as a dense polyline (arcs every 1 degree); each chord is a G4CutTubs whose end planes are the mitre
  // planes shared with its neighbours. (True torus segments were tried first: the quartic solver is unreliable for a 0.65 mm
  // tube on a 25 mm ring - photons hopped from core to tile to groove at every torus joint.)
  int fiberId = 0;
  auto placeFiber = [&](const std::vector<FiberPt>& path, double zOff) {
    std::vector<FiberPt> q;                                        // drop repeated points
    for (auto& pt : path) if (q.empty() || std::hypot(pt.x - q.back().x, pt.y - q.back().y) > 1e-4) q.push_back(pt);
    auto dirAt = [&](size_t i) { const double dx = q[i + 1].x - q[i].x, dy = q[i + 1].y - q[i].y, l = std::hypot(dx, dy); return G4ThreeVector(dx / l, dy / l, 0); };
    for (size_t i = 0; i + 1 < q.size(); ++i) {
      const G4ThreeVector u = dirAt(i);
      const G4ThreeVector uPrev = i ? dirAt(i - 1) : u, uNext = i + 2 < q.size() ? dirAt(i + 1) : u;
      const double L = std::hypot(q[i + 1].x - q[i].x, q[i + 1].y - q[i].y);
      G4RotationMatrix active; active.rotateY(90 * deg); active.rotateZ(std::atan2(u.y(), u.x()));   // local z -> chord direction
      const G4RotationMatrix inv = active.inverse();
      G4ThreeVector nLow = -(uPrev + u), nHigh = uNext + u;      // mitre planes shared with the neighbours (outward normals)
      nLow = inv * nLow.unit(); nHigh = inv * nHigh.unit();
      auto mk = [&](double rad, const char* nm) { return new G4CutTubs(nm, 0, rad, 0.5 * L, 0, 360 * deg, nLow, nHigh); };
      auto* cladLV = new G4LogicalVolume(mk(clad_r, "fclad"), wlsClad, "fiber_clad_seg");
      auto* coreLV = new G4LogicalVolume(mk(fiber_r, "fcore"), wlsCore, "fiber_core_seg");
      auto* grooveLV = new G4LogicalVolume(mk(groove_r, "fgroove"), epoxy, "fiber_groove_seg");
      new G4PVPlacement(nullptr, G4ThreeVector(), coreLV, "fiber_core", cladLV, false, fiberId);
      new G4PVPlacement(nullptr, G4ThreeVector(), cladLV, "fiber_clad", grooveLV, false, fiberId);
      // G4PVPlacement takes the *frame* rotation (inverse of the active one): without the inverse every diagonal piece is mirrored.
      new G4PVPlacement(new G4RotationMatrix(inv), G4ThreeVector(0.5 * (q[i].x + q[i + 1].x), 0.5 * (q[i].y + q[i + 1].y), z_mid + zOff),
                        grooveLV, "fiber_groove", scintLV, false, fiberId++, false);
    }
  };
  if (fiberPath.size() >= 2) {
    std::vector<FiberPt> raw;
    for (auto p : fiberPath) raw.push_back({p.x * mm, p.y * mm});
    placeFiber(raw, 0.0);
  }

  // ---- Coating (50 um) and wrap (100 um Al foil, 30 um cling film, 100 um black vinyl): shells around the tile outline ----
  G4double dx = xmax - xmin, dy = ymax - ymin, dz = zmax - zmin;
  G4ThreeVector c(0.5 * (xmin + xmax), 0.5 * (ymin + ymax), 0.5 * (zmin + zmax));
  const double sxw = (std::abs(sx) > 0.1 * mm) ? sx : 0.5 * (xmin + xmax);
  auto* window = new G4Box("CouplerWindow", 0.5 * bsx, 1.0 * mm, 2.2 * mm);   // opening for the whole coupler footprint
  const G4ThreeVector winAt(sxw - c.x(), ymax - c.y(), z_mid - c.z());
  // Convex outline grown outward by d (mitred corners): the coating and every wrap layer follow the tile's real outline,
  // slanted edges included (the first version used the bounding box, which leaves a wedge of air on slanted tiles).
  auto grow = [&](double d) {
    std::vector<G4TwoVector> o; const size_t n = hullPoly.size();
    double cx = 0, cy = 0; for (auto& q : hullPoly) { cx += q.x() / n; cy += q.y() / n; }
    for (size_t i = 0; i < n; ++i) {
      const auto &a = hullPoly[(i + n - 1) % n], &b = hullPoly[i], &e = hullPoly[(i + 1) % n];
      auto nrm = [&](const G4TwoVector& p, const G4TwoVector& q) {
        G4TwoVector t = q - p; G4TwoVector v(t.y() / t.mag(), -t.x() / t.mag());
        if (v.x() * (0.5 * (p.x() + q.x()) - cx) + v.y() * (0.5 * (p.y() + q.y()) - cy) < 0) v = -v; return v; };
      const G4TwoVector n0 = nrm(a, b), n1 = nrm(b, e);
      o.push_back(b + (n0 + n1) * (d / (1 + n0.x() * n1.x() + n0.y() * n1.y())));
    }
    return o;
  };
  auto shell = [&](const char* name, double r0, double r1, G4Material* m) {
    G4VSolid *o, *in; G4ThreeVector at = c, wat = winAt;
    if (!hullPoly.empty()) {
      o = new G4ExtrudedSolid(G4String(name) + "O", grow(r1), 0.5 * dz + r1, {0, 0}, 1, {0, 0}, 1);
      in = new G4ExtrudedSolid(G4String(name) + "I", r0 > 0 ? grow(r0) : hullPoly, 0.5 * dz + r0, {0, 0}, 1, {0, 0}, 1);
      at = G4ThreeVector(0, 0, z_mid); wat = G4ThreeVector(sxw, ymax, 0);
    } else {
      o = new G4Box(G4String(name) + "O", 0.5 * dx + r1, 0.5 * dy + r1, 0.5 * dz + r1);
      in = new G4Box(G4String(name) + "I", 0.5 * dx + r0, 0.5 * dy + r0, 0.5 * dz + r0);
    }
    auto* hollow = new G4SubtractionSolid(G4String(name) + "H", o, in);
    auto* lv = new G4LogicalVolume(new G4SubtractionSolid(name, hollow, window, nullptr, wat), m, G4String(name) + "LV");
    new G4PVPlacement(nullptr, at, lv, name, worldLV, false, 0);
    return lv;
  };
  auto* coatLV = shell("DiffuseCoating", 0, coat_t, coating);
  double r = coat_t;
  auto* foilLV = shell("LightTightWrap_Al", r, r + foil_t, foil); r += foil_t;
  shell("LightTightWrap_Cling", r, r + cling_t, cling); r += cling_t;
  auto* wrapLV = shell("LightTightWrap_Vinyl", r, r + vinyl_t, vinyl);
  (void)foilLV;

  // ---- Coupler + Hamamatsu S12572-33-015P ----
  // Compact black ABS block on the SiPM edge (16 mm wide): both fiber ends, 1.2 mm apart, face ONE 3 x 3 mm SiPM centred
  // between them across the published 0.75 mm air gap (Aidala et al., Table II and Fig. 6c).
  const double wrapOut = coat_t + foil_t + cling_t + vinyl_t + 0.01 * mm;
  const double by0 = ymax + wrapOut, by1 = ymax + 6.0 * mm;
  G4double sipmFace = 3.0 * mm, sipmDepth = 1.5 * mm;   // S12572-33-015P active area 3 x 3 mm^2
  if (ssx < 2.5 * mm) ssx = sipmFace;
  if (ssz < 2.5 * mm) ssz = sipmFace;
  if (ssy < 0.4 * mm) ssy = sipmDepth;
  sx = sxw; sz = z_mid;
  struct Chamber { double cx, hx, top, sipmCy; };
  std::vector<Chamber> chambers;
  chambers.push_back({sxw, 2.5 * mm, ymax + fAirGapMm * mm, ymax + fAirGapMm * mm + 0.5 * ssy});
  const double blkCy = 0.5 * (by0 + by1);
  G4VSolid* blockSolid = new G4Box("BlockerBox", 0.5 * bsx, 0.5 * (by1 - by0), 0.5 * bsz);
  int nch = 0;
  for (const auto& ch : chambers) {
    const double h = ch.top - by0 + 0.02 * mm;
    blockSolid = new G4SubtractionSolid("BlockerC" + std::to_string(nch), blockSolid, new G4Box("Cav", ch.hx, 0.5 * h, 2.0 * mm), nullptr,
                                        G4ThreeVector(ch.cx - sxw, by0 - 0.02 * mm + 0.5 * h - blkCy, 0));
    blockSolid = new G4SubtractionSolid("BlockerS" + std::to_string(nch++), blockSolid, new G4Box("SiPMCut", 0.5 * ssx, 0.5 * ssy, 0.5 * ssz), nullptr,
                                        G4ThreeVector(ch.cx - sxw, ch.sipmCy - blkCy, 0));
  }
  auto* blockLV = new G4LogicalVolume(blockSolid, absPlastic, "LightBlockerLV");
  auto* blockPV = new G4PVPlacement(nullptr, G4ThreeVector(sxw, blkCy, z_mid), blockLV, "LightBlocker", worldLV, false, 0);
  auto* sipmLV = new G4LogicalVolume(new G4Box("SiPMBox", 0.5 * ssx, 0.5 * ssy, 0.5 * ssz), si, "SiPMLV");
  int copy = 0;
  for (const auto& ch : chambers) new G4PVPlacement(nullptr, G4ThreeVector(ch.cx, ch.sipmCy, z_mid), sipmLV, "SiPM_S12572_015P", worldLV, false, copy++);
  const double airGap = fAirGapMm * mm; const double sipmCy = chambers[0].sipmCy;

  SetupSurfaces(worldPV, scintPV, blockPV);

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
  // One photon-energy grid for every material (a photon must find RINDEX wherever it goes).
  // 2.00 eV = 620 nm … 3.40 eV = 365 nm.
  // The grid is fine around 2.5-2.9 eV: Y11 absorbs above ~2.7 eV and emits below it. A coarse grid smeared the two
  // spectra into each other, so WLS photons were re-absorbed almost as fast as they were emitted.
  const G4int n = 15;
  G4double E[n] = {2.00 * eV, 2.10 * eV, 2.20 * eV, 2.30 * eV, 2.40 * eV, 2.48 * eV, 2.54 * eV, 2.60 * eV,
                   2.70 * eV, 2.80 * eV, 2.88 * eV, 3.00 * eV, 3.10 * eV, 3.30 * eV, 3.50 * eV};
  auto flat = [&](double v) { std::vector<G4double> o(n, v); return o; };
  auto table = [&](G4Material* mat, double rindex, double absLen) {
    auto* mpt = new G4MaterialPropertiesTable();
    mpt->AddProperty("RINDEX", E, flat(rindex).data(), n);
    if (absLen > 0) mpt->AddProperty("ABSLENGTH", E, flat(absLen).data(), n);
    mat->SetMaterialPropertiesTable(mpt);
    return mpt;
  };

  // Scintillator: PS n 1.59; POPOP emission 400-450 nm (peak 420 nm ≈ 2.95 eV); lateral attenuation 2-2.5 m
  // (sPHENIX tile QA); decay ≈ 2.4 ns. Yield is a parameter (extruded PS ≈ 50-60% of anthracene) [EST 8000 ph/MeV].
  if (auto* mat = G4Material::GetMaterial("PS_PTP_POPOP", false)) {
    auto* mpt = table(mat, 1.59, 2.2 * m);
    G4double popop[n] = {0, 0, 0, 0, 0, 0.02, 0.05, 0.25, 0.60, 0.90, 1.00, 0.80, 0.40, 0.05, 0};
#if G4VERSION_NUMBER >= 1100
    mpt->AddProperty("SCINTILLATIONCOMPONENT1", E, popop, n);
    mpt->AddConstProperty("SCINTILLATIONTIMECONSTANT1", 2.4 * ns);
    mpt->AddConstProperty("SCINTILLATIONYIELD1", 1.0);
#else
    mpt->AddProperty("FASTCOMPONENT", E, popop, n);
    mpt->AddConstProperty("FASTTIMECONSTANT", 2.4 * ns);
    mpt->AddConstProperty("YIELDRATIO", 1.0);
#endif
    mpt->AddConstProperty("SCINTILLATIONYIELD", fScintYield / MeV);
    mpt->AddConstProperty("RESOLUTIONSCALE", 1.0);
  }

  // Kuraray Y11(200) K-27 S-type: absorbs 350-470 nm (peak 430 nm), emits 476 nm peak, decay ≈ 7 ns,
  // attenuation > 3.5 m for the re-emitted light; PS core n 1.59, PMMA clad n 1.49.
  if (auto* mat = G4Material::GetMaterial("Y11_Core_PS", false)) {
    auto* mpt = table(mat, 1.59, 3.5 * m);
    G4double wlsAbs[n] = {1e3 * m, 1e3 * m, 1e3 * m, 1e3 * m, 200 * m, 50 * m, 20 * m, 5.0 * m,
                          5.0 * mm, 0.5 * mm, 0.2 * mm, 0.25 * mm, 0.4 * mm, 1.0 * mm, 3.0 * mm};
    G4double wlsEm[n] = {0.0, 0.03, 0.20, 0.55, 0.95, 1.00, 0.75, 0.35, 0.03, 0, 0, 0, 0, 0, 0};
    mpt->AddProperty("WLSABSLENGTH", E, wlsAbs, n);
    mpt->AddProperty("WLSCOMPONENT", E, wlsEm, n);
    mpt->AddConstProperty("WLSTIMECONSTANT", 7.0 * ns);
    mpt->AddConstProperty("WLSMEANNUMBERPHOTONS", fWLSEff);
  }
  if (auto* mat = G4Material::GetMaterial("Y11_Clad_PMMA", false)) table(mat, 1.49, 3.5 * m);
  if (auto* mat = G4Material::GetMaterial("EPOTEK301", false)) table(mat, 1.52, 1.0 * m);
  if (auto* mat = G4Material::GetMaterial("G4_AIR", false)) table(mat, 1.0, 0);
  // SiPM: silicone entrance window n 1.55, absorbed in the first micron. Without an RINDEX Geant4 kills every photon
  // at the boundary *before* it enters the SiPM volume, so the sensitive detector never counted a single one.
  if (auto* mat = G4Material::GetMaterial("G4_Si", false)) table(mat, 1.55, 0.001 * mm);

  // Painted-on diffuse reflector (TiO2): R ≈ 0.95, Lambertian
  fReflectorSurf = new G4OpticalSurface("HCalReflector", unified, groundfrontpainted, dielectric_dielectric);
  auto* refMPT = new G4MaterialPropertiesTable();
  G4double refE[2] = {2.0 * eV, 3.5 * eV};
  G4double refR[2] = {0.95, 0.95};
  refMPT->AddProperty("REFLECTIVITY", refE, refR, 2);
  fReflectorSurf->SetMaterialPropertiesTable(refMPT);
  fCouplerSurf = new G4OpticalSurface("CouplerWhite", unified, groundfrontpainted, dielectric_dielectric);
  auto* cpMPT = new G4MaterialPropertiesTable();
  G4double cpR[2] = {0.05, 0.05};   // black light blocker
  cpMPT->AddProperty("REFLECTIVITY", refE, cpR, 2);
  fCouplerSurf->SetMaterialPropertiesTable(cpMPT);
}

void HcalTileDetectorConstruction::SetupSurfaces(G4VPhysicalVolume* world, G4VPhysicalVolume* tile, G4VPhysicalVolume* block) {
  // The coating is painted on: a border surface tile -> outside. It must NOT be a skin surface on the tile LV, or it
  // would also sit between the tile and its fiber grooves and keep all light out of the fiber.
  new G4LogicalBorderSurface("TileCoating", tile, world, fReflectorSurf);
  // border surfaces are one-way: the coating also reflects light that reaches the tile from outside (the coupler cavity
  // floor is the painted tile edge; without this, photons bounced off the cavity ceiling re-entered the tile and were lost)
  new G4LogicalBorderSurface("TileCoatingIn", world, tile, fReflectorSurf);
  new G4LogicalBorderSurface("CouplerWhite", world, block, fCouplerSurf);   // white diffuse mixing cavity
  auto* absSurf = new G4OpticalSurface("HCalAbsorber", unified, ground, dielectric_metal);
  auto* absMPT = new G4MaterialPropertiesTable();
  G4double refE[2] = {2.0 * eV, 3.5 * eV};
  G4double absR[2] = {0.05, 0.05};
  absMPT->AddProperty("REFLECTIVITY", refE, absR, 2);
  absSurf->SetMaterialPropertiesTable(absMPT);
  for (auto* lv : *G4LogicalVolumeStore::GetInstance()) {
    const G4String& nm = lv->GetName();
    if (nm.find("DiffuseCoating") != std::string::npos) new G4LogicalSkinSurface(nm + "_refl", lv, fReflectorSurf);
    if (nm.find("LightTight") != std::string::npos)
      new G4LogicalSkinSurface(nm + "_abs", lv, absSurf);
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
