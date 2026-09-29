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

  // ---- Tessellated scintillator from original GDML mesh ----
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

  auto* scintLV = new G4LogicalVolume(tess, scintMat, "InnerHCalTile_PS");
  auto* scintPV = new G4PVPlacement(nullptr, G4ThreeVector(), scintLV, "InnerHCalTile_PS", worldLV, false, 0);

  // ---- Fiber: epoxy-filled groove > PMMA cladding > PS core, nested INSIDE the tile ----
  // (siblings overlapping the tile are undefined in Geant4). Straight pieces are trimmed at the polyline joints by
  // groove_r·tan(θ/2) so neighbours never overlap; the wedge left at the outer corner is tile material.
  // The two fiber ends leave the tile at the connector pocket floor and bend (in air, S-curves) into the coupler,
  // side by side on the 3×3 mm SiPM (the mesh JSON left them 21 mm either side of it).
  double yFloor = ExtractNumber(json.substr(json.find("\"pocket\"") == std::string::npos ? 0 : json.find("\"pocket\"")), "y_floor", ymax / mm) * mm;
  auto placeFiber = [&](const std::vector<FiberPt>& path, G4LogicalVolume* mother, bool groove, int id0, double zOff) {
    auto half = [&](size_t i) {
      if (i == 0 || i + 1 >= path.size()) return 0.0;
      double a1 = std::atan2(path[i].y - path[i - 1].y, path[i].x - path[i - 1].x);
      double a2 = std::atan2(path[i + 1].y - path[i].y, path[i + 1].x - path[i].x);
      return 0.5 * std::abs(std::remainder(a2 - a1, 2 * M_PI));
    };
    const double rOut = groove ? groove_r : clad_r;
    for (size_t i = 0; i + 1 < path.size(); ++i) {
      double x1 = path[i].x, y1 = path[i].y, x2 = path[i + 1].x, y2 = path[i + 1].y;
      double dx = x2 - x1, dy = y2 - y1, len = std::hypot(dx, dy);
      auto trim = [&](double h) { return rOut * (std::tan(h) + std::sin(h)) + 0.01 * mm; };  // clears the 3D end disc too
      double t1 = i == 0 ? 0 : trim(half(i));
      double t2 = i + 2 == path.size() ? 0 : trim(half(i + 1));
      double L = len - t1 - t2;
      if (L < 0.05 * mm) continue;
      double ux = dx / len, uy = dy / len;
      G4ThreeVector pos(x1 + ux * (t1 + 0.5 * L), y1 + uy * (t1 + 0.5 * L), z_mid + zOff);
      auto* cladLV = new G4LogicalVolume(new G4Tubs("fclad", 0, clad_r, 0.5 * L, 0, 360 * deg), wlsClad, "fiber_clad_seg");
      auto* coreLV = new G4LogicalVolume(new G4Tubs("fcore", 0, fiber_r, 0.5 * L, 0, 360 * deg), wlsCore, "fiber_core_seg");
      new G4PVPlacement(nullptr, G4ThreeVector(), coreLV, "fiber_core", cladLV, false, id0 + (G4int)i);
      G4LogicalVolume* outer = cladLV;
      if (groove) {
        outer = new G4LogicalVolume(new G4Tubs("fgroove", 0, groove_r, 0.5 * L, 0, 360 * deg), epoxy, "fiber_groove_seg");
        new G4PVPlacement(nullptr, G4ThreeVector(), cladLV, "fiber_clad", outer, false, id0 + (G4int)i);
      }
      // G4PVPlacement takes the *frame* rotation (inverse of the active one): without the inverse every diagonal
      // piece is mirrored about the path — it left the tile by 5.8 mm and broke the light guide at every bend.
      G4RotationMatrix active;
      active.rotateY(90 * deg);
      active.rotateZ(std::atan2(dy, dx));
      auto* rot = new G4RotationMatrix(active.inverse());
      new G4PVPlacement(rot, pos, outer, groove ? "fiber_groove" : "fiber_clad", mother, false, id0 + (G4int)i, false);
    }
  };
  if (fiberPath.size() >= 2) {
    std::vector<FiberPt> inTile;
    for (auto p : fiberPath) inTile.push_back({p.x * mm, p.y * mm});
    const bool pocket = yFloor < ymax - 1 * mm;
    if (pocket) {  // ends flush with the pocket floor: light leaves core -> air, never through the painted face
      inTile.front().y = std::min(inTile.front().y, yFloor);
      inTile.back().y = std::min(inTile.back().y, yFloor);
    }
    // The mesh path doubles back along y = 8 and its return leg crosses three other legs in the same plane:
    // lay the return (from the doubling-back point on) in its own groove 1.4 mm deeper.
    size_t split = inTile.size();
    for (size_t i = 1; i + 1 < inTile.size(); ++i) {
      double ax = inTile[i].x - inTile[i - 1].x, ay = inTile[i].y - inTile[i - 1].y;
      double bx = inTile[i + 1].x - inTile[i].x, by2 = inTile[i + 1].y - inTile[i].y;
      if (ax * bx + ay * by2 < -0.9 * std::hypot(ax, ay) * std::hypot(bx, by2)) { split = i; break; }  // hairpin
    }
    const double zRet = -1.4 * mm;
    if (split < inTile.size()) {
      placeFiber(std::vector<FiberPt>(inTile.begin(), inTile.begin() + split + 1), scintLV, true, 0, 0);
      placeFiber(std::vector<FiberPt>(inTile.begin() + split, inTile.end()), scintLV, true, 500, zRet);
    } else {
      placeFiber(inTile, scintLV, true, 0, 0);
    }
    if (pocket) {
      double xs0 = (std::abs(sx) > 0.1 * mm) ? sx : 0.5 * (xmin + xmax);
      FiberPt ends[2] = {inTile.front(), inTile.back()};
      double targets[2] = {xs0 - 0.55 * mm, xs0 + 0.55 * mm};
      if (ends[0].x > ends[1].x) std::swap(targets[0], targets[1]);
      for (int e = 0; e < 2; ++e) {  // cubic Bézier, vertical tangents at both ends, 16 pieces
        FiberPt a{ends[e].x, yFloor}, b{targets[e], ymax};
        double h = 0.45 * (b.y - a.y);
        std::vector<FiberPt> curve;
        for (int k = 0; k <= 16; ++k) {
          double t = k / 16.0, u = 1 - t;
          double x = u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x;
          double y = u * u * u * a.y + 3 * u * u * t * (a.y + h) + 3 * u * t * t * (b.y - h) + t * t * t * b.y;
          curve.push_back({x, y});
        }
        const bool isReturn = split < inTile.size() && e == 1;
        placeFiber(curve, worldLV, false, 1000 + 100 * e, isReturn ? zRet : 0);
      }
    }
  }

  // ---- Coating and wrap shells (bbox-based) ----
  G4double dx = xmax - xmin, dy = ymax - ymin, dz = zmax - zmin;
  G4ThreeVector c(0.5 * (xmin + xmax), 0.5 * (ymin + ymax), 0.5 * (zmin + zmax));
  const double sxw = (std::abs(sx) > 0.1 * mm) ? sx : 0.5 * (xmin + xmax);
  auto* window = new G4Box("CouplerWindow", 2.0 * mm, 1.0 * mm, 2.0 * mm);   // 4 × 4 mm opening at the SiPM
  const G4ThreeVector winAt(sxw - c.x(), ymax - c.y(), z_mid - c.z());
  auto shell = [&](const char* name, double r0, double r1, G4Material* m) {
    auto* o = new G4Box(G4String(name) + "O", 0.5 * dx + r1, 0.5 * dy + r1, 0.5 * dz + r1);
    auto* in = new G4Box(G4String(name) + "I", 0.5 * dx + r0, 0.5 * dy + r0, 0.5 * dz + r0);
    auto* hollow = new G4SubtractionSolid(G4String(name) + "H", o, in);
    auto* lv = new G4LogicalVolume(new G4SubtractionSolid(name, hollow, window, nullptr, winAt), m, G4String(name) + "LV");
    new G4PVPlacement(nullptr, c, lv, name, worldLV, false, 0);
    return lv;
  };
  auto* coatLV = shell("DiffuseCoating", 0, coat_t, coating);
  double r = coat_t;
  auto* foilLV = shell("LightTightWrap_Al", r, r + foil_t, foil); r += foil_t;
  shell("LightTightWrap_Cling", r, r + cling_t, cling); r += cling_t;
  auto* wrapLV = shell("LightTightWrap_Vinyl", r, r + vinyl_t, vinyl);
  (void)foilLV;

  // ---- Light blocker + Hamamatsu S12572-33-015P SiPM ----
  // Dual WLS fiber ends exit at the outer radius into a plastic coupler (light
  // blocker). An air gap (~0.75 mm, sPHENIX tile design) between the polished
  // fiber ends and the SiPM face spreads light over the 3×3 mm² active area and
  // reduces optical saturation (Aidala et al., IEEE TNS 2018).
  // The coupler starts outside the coating + wrap (it no longer overlaps the tile or the SiPM): a black block with a
  // 4 × 4 mm cavity holding the SiPM behind the air gap.
  const double wrapOut = coat_t + foil_t + cling_t + vinyl_t + 0.01 * mm;
  const double cy0 = ymax + wrapOut, cy1 = std::max(cy0 + 2.5 * mm, by + 0.5 * bsy);
  const double cavY1 = ymax + fAirGapMm * mm + sipmDepthFor(ssy) + 0.1 * mm;
  auto* blockSolid = new G4SubtractionSolid("Blocker",
      new G4Box("BlockerBox", 0.5 * bsx, 0.5 * (cy1 - cy0), 0.5 * bsz),
      new G4Box("BlockerCavity", 2.0 * mm, 0.5 * (cavY1 - cy0) + 0.01 * mm, 2.0 * mm), nullptr,
      G4ThreeVector(sxw - bx, -0.5 * (cy1 - cy0) + 0.5 * (cavY1 - cy0) - 0.005 * mm, z_mid - bz));
  auto* blockLV = new G4LogicalVolume(blockSolid, absPlastic, "LightBlockerLV");
  new G4PVPlacement(nullptr, G4ThreeVector(bx, 0.5 * (cy0 + cy1), bz), blockLV, "LightBlocker", worldLV, false, 0);

  // Prefer CAD/JSON placement; enforce nominal 3×3 mm active face and package depth.
  // ssy is the thickness along the fiber-exit axis (local Y in tile coords).
  G4double sipmFace = 3.0 * mm;   // S12572-33-015P active area 3×3 mm²
  G4double sipmDepth = 1.5 * mm;  // ceramic package depth (approx.)
  if (ssx < 2.5 * mm) ssx = sipmFace;
  if (ssz < 2.5 * mm) ssz = sipmFace;
  if (ssy < 0.4 * mm) ssy = sipmDepth;

  // Place SiPM so its entrance face is fAirGapMm beyond ymax (fiber exit plane).
  G4double airGap = fAirGapMm * mm;
  G4double sipmCy = ymax + airGap + 0.5 * ssy;   // fiber ends are flush with ymax
  sx = (std::abs(sx) > 0.1 * mm) ? sx : 0.5 * (xmin + xmax);
  sz = (std::abs(sz) > 0.1 * mm) ? sz : 0.5 * (zmin + zmax);

  auto* sipmLV = new G4LogicalVolume(new G4Box("SiPMBox", 0.5 * ssx, 0.5 * ssy, 0.5 * ssz), si, "SiPMLV");
  // Volume name encodes the Hamamatsu part for SD / debugging
  sipmLV->SetName("SiPMLV");  // keep SD attachment name stable
  new G4PVPlacement(nullptr, G4ThreeVector(sx, sipmCy, sz), sipmLV, "SiPM_S12572_015P", worldLV, false, 0);

  SetupSurfaces(worldPV, scintPV);

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
  const G4int n = 8;
  G4double E[n] = {2.00 * eV, 2.30 * eV, 2.50 * eV, 2.60 * eV, 2.75 * eV, 2.90 * eV, 3.10 * eV, 3.40 * eV};
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
    G4double popop[n] = {0.0, 0.0, 0.02, 0.10, 0.45, 1.00, 0.35, 0.0};
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
    G4double wlsAbs[n] = {100 * m, 10 * m, 3.0 * m, 1.0 * m, 5.0 * mm, 0.2 * mm, 0.3 * mm, 2.0 * mm};
    G4double wlsEm[n] = {0.02, 0.35, 0.95, 1.00, 0.30, 0.02, 0.0, 0.0};
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
}

void HcalTileDetectorConstruction::SetupSurfaces(G4VPhysicalVolume* world, G4VPhysicalVolume* tile) {
  // The coating is painted on: a border surface tile -> outside. It must NOT be a skin surface on the tile LV, or it
  // would also sit between the tile and its fiber grooves and keep all light out of the fiber.
  new G4LogicalBorderSurface("TileCoating", tile, world, fReflectorSurf);
  auto* absSurf = new G4OpticalSurface("HCalAbsorber", unified, ground, dielectric_metal);
  auto* absMPT = new G4MaterialPropertiesTable();
  G4double refE[2] = {2.0 * eV, 3.5 * eV};
  G4double absR[2] = {0.05, 0.05};
  absMPT->AddProperty("REFLECTIVITY", refE, absR, 2);
  absSurf->SetMaterialPropertiesTable(absMPT);
  for (auto* lv : *G4LogicalVolumeStore::GetInstance()) {
    const G4String& nm = lv->GetName();
    if (nm.find("DiffuseCoating") != std::string::npos) new G4LogicalSkinSurface(nm + "_refl", lv, fReflectorSurf);
    if (nm.find("LightTight") != std::string::npos || nm.find("LightBlocker") != std::string::npos)
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
