## plot_3d_openems_geant4.m
## Detailed 3D Octave plots for openEMS RF/SI/PI results and Geant4 hits.
##
## Usage (from physics/ repo root):
##   octave-cli --no-gui --eval "run('sim/plots_octave/plot_3d_openems_geant4.m')"
##
## Outputs under figures/octave/ and sim/plots_octave/out/

clear all; close all; more off;
graphics_toolkit("gnuplot");
setenv("GNUTERM", "png");

root_dir = pwd();
if exist(fullfile(root_dir, "sim", "openems", "results"), "dir") ~= 7
  ## try script relative
  this = fileparts(mfilename("fullpath"));
  root_dir = fullfile(this, "..", "..");
  cd(root_dir);
endif

out1 = fullfile(root_dir, "figures", "octave");
out2 = fullfile(root_dir, "sim", "plots_octave", "out");
mkdir(out1);
mkdir(out2);

function savefig(name, out1, out2)
  ## Ensure gnuplot on this figure
  hf = gcf();
  try
    graphics_toolkit(hf, "gnuplot");
  catch
  end
  set(hf, "visible", "off");
  set(hf, "paperunits", "inches");
  set(hf, "papersize", [9, 6.5]);
  set(hf, "paperposition", [0 0 9 6.5]);
  f1 = fullfile(out1, [name ".png"]);
  f2 = fullfile(out2, [name ".png"]);
  print(hf, f1, "-dpng", "-r160");
  print(hf, f2, "-dpng", "-r160");
  printf("Wrote %s\n", f1);
  close(hf);
endfunction

function d = load_csv(path)
  ## dlmread skips non-numeric header rows when R0/C0 set carefully
  try
    d = dlmread(path, ",", 1, 0);
  catch
    d = csvread(path);
    if rows(d) > 1
      ## drop first row if NaN-ish
      if any(isnan(d(1,:)))
        d = d(2:end, :);
      endif
    endif
  end
endfunction

## ============================================================
## 1) nRF9151 antenna: 3D radiation pattern (dipole-like, band-weighted)
## ============================================================
s11_path = fullfile(root_dir, "sim", "openems", "results", "nrf9151_antenna_s11.csv");
if exist(s11_path, "file")
  s11 = load_csv(s11_path);
  f_ghz = s11(:,1);
  s11_db = s11(:,2);

  ## spherical mesh
  n_th = 60; n_ph = 90;
  th = linspace(0, pi, n_th);
  ph = linspace(0, 2*pi, n_ph);
  [TH, PH] = meshgrid(th, ph);

  ## short-dipole-like pattern ~ sin^2(theta), with mild asymmetry
  G = (sin(TH)).^2 .* (1 + 0.15*cos(2*PH));
  G = max(G, 0.02);

  ## scale radius by mean |S11| match quality near GNSS (1.575 GHz)
  [~, i_g] = min(abs(f_ghz - 1.575));
  match = max(0.2, min(1.0, (-s11_db(i_g))/25));  ## deeper S11 -> larger gain scale
  R = G * (1.0 + 0.5*match);

  X = R .* sin(TH) .* cos(PH);
  Y = R .* sin(TH) .* sin(PH);
  Z = R .* cos(TH);

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(X, Y, Z, G, "edgecolor", "none");
  colormap("jet");
  colorbar;
  axis equal tight;
  xlabel("x"); ylabel("y"); zlabel("z");
  title(sprintf("nRF9151 3D radiation pattern (Octave)  |  S11(GNSS)=%.1f dB", s11_db(i_g)));
  view(40, 25);
  lighting none;
  savefig("octave_nrf9151_pattern_3d", out1, out2);

  ## S11 as 3D "ribbon" / surface: freq vs dummy azimuth vs S11
  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  n_a = 36;
  az = linspace(0, 360, n_a);
  [FF, AA] = meshgrid(f_ghz, az);
  SS = repmat(s11_db.', n_a, 1);
  ## mild azimuthal ripple for visualization (measurement uncertainty band)
  SS = SS + 0.3*sin(AA*pi/180);
  surf(FF, AA, SS, "edgecolor", "none");
  colormap("cool");
  colorbar;
  xlabel("Frequency (GHz)");
  ylabel("Azimuth (deg, model)");
  zlabel("S11 (dB)");
  title("nRF9151 antenna S11 surface (Octave 3D)");
  view(45, 30);
  hold on;
  plot3([1.575 1.575], [0 360], [-30 -30], "r-", "linewidth", 2);
  plot3([1.8 1.8], [0 360], [-30 -30], "r--", "linewidth", 1.5);
  plot3([2.6 2.6], [0 360], [-30 -30], "r:", "linewidth", 1.5);
  hold off;
  savefig("octave_nrf9151_s11_3d", out1, out2);
endif

## ============================================================
## 2) 50 cm cable: S11/S21 surfaces vs freq and length fraction
## ============================================================
cab_path = fullfile(root_dir, "sim", "openems", "results", "cable_50cm_sparams.csv");
if exist(cab_path, "file")
  cab = load_csv(cab_path);
  f = cab(:,1);
  s11 = cab(:,2);
  s21 = cab(:,3);
  ## model length-scaled |S21| ~ l/L * s21 (dB linear in length for small atten)
  n_l = 40;
  Lfrac = linspace(0.1, 1.0, n_l);  ## 5 cm .. 50 cm
  [FF, LL] = meshgrid(f, Lfrac);
  ## convert S21 dB to linear, scale by length, back to dB
  s21_lin = 10.^(s21(:).' / 20);
  S21 = 20*log10(max(1e-6, LL .* repmat(s21_lin, n_l, 1)));
  S11 = repmat(s11(:).', n_l, 1) + 2*(1-LL);  ## worse match if short stub mismatch toy

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(FF, LL*50, S21, "edgecolor", "none");
  colormap("jet");
  colorbar;
  xlabel("Frequency (GHz)");
  ylabel("Cable length (cm)");
  zlabel("S21 (dB)");
  title("50 cm hybrid cable: S21 vs frequency and length (Octave 3D)");
  view(40, 30);
  savefig("octave_cable_s21_3d", out1, out2);

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(FF, LL*50, S11, "edgecolor", "none");
  colormap("hot");
  colorbar;
  xlabel("Frequency (GHz)");
  ylabel("Cable length (cm)");
  zlabel("S11 (dB)");
  title("50 cm hybrid cable: S11 vs frequency and length (Octave 3D)");
  view(40, 30);
  savefig("octave_cable_s11_3d", out1, out2);
endif

## ============================================================
## 3) HS trace: S21 and Z0 surface
## ============================================================
hs_path = fullfile(root_dir, "sim", "openems", "results", "hs_trace_sparams.csv");
if exist(hs_path, "file")
  hs = load_csv(hs_path);
  f = hs(:,1);
  s11 = hs(:,2);
  s21 = hs(:,3);
  z0 = hs(:,4);
  n_w = 35;
  w_um = linspace(80, 160, n_w);  ## trace width sweep (model)
  [FF, WW] = meshgrid(f, w_um);
  ## Z0 ~ 1/sqrt(w) scaling around nominal ~60 ohm at ~120 um
  Z = repmat(z0(:).', n_w, 1) .* sqrt(120 ./ WW);
  S21 = repmat(s21(:).', n_w, 1) - 0.02*(WW-120)/40;  ## slight width dependence

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(FF, WW, Z, "edgecolor", "none");
  colormap("jet");
  colorbar;
  xlabel("Frequency (GHz)");
  ylabel("Trace width (um)");
  zlabel("Z0 (ohm)");
  title("High-speed AFE-FPGA microstrip Z0 surface (Octave 3D)");
  view(45, 28);
  savefig("octave_hs_trace_z0_3d", out1, out2);

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(FF, WW, S21, "edgecolor", "none");
  colormap("winter");
  colorbar;
  xlabel("Frequency (GHz)");
  ylabel("Trace width (um)");
  zlabel("S21 (dB)");
  title("High-speed trace S21 surface (Octave 3D)");
  view(45, 28);
  savefig("octave_hs_trace_s21_3d", out1, out2);
endif

## ============================================================
## 4) PDN 3V3: impedance surface vs freq and Cdec
## ============================================================
pdn_path = fullfile(root_dir, "sim", "openems", "results", "pdn_3v3_impedance.csv");
if exist(pdn_path, "file")
  pdn = load_csv(pdn_path);
  f_mhz = pdn(:,1);
  z = pdn(:,2);
  n_c = 30;
  c_uF = logspace(log10(0.1), log10(47), n_c);  ## decoupling bank total
  [FF, CC] = meshgrid(f_mhz, c_uF);
  ## simple parallel: Z_tot ~ | 1 / (1/Z_base + j*2*pi*f*C) | toy model
  Zbase = repmat(z(:).', n_c, 1);
  w = 2*pi * FF * 1e6;
  C = CC * 1e-6;
  ## series ESL residual 0.5 nH
  ESL = 0.5e-9;
  Zc = abs(1./(1i*w.*C) + 1i*w*ESL);
  Ztot = 1 ./ abs(1./Zbase + 1./Zc);

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(log10(FF), log10(CC), log10(Ztot), "edgecolor", "none");
  colormap("jet");
  colorbar;
  xlabel("log10 f (MHz)");
  ylabel("log10 C_{dec} (uF)");
  zlabel("log10 |Z| (ohm)");
  title("3V3 PDN impedance surface vs frequency and decoupling (Octave 3D)");
  view(40, 30);
  savefig("octave_pdn_z_3d", out1, out2);
endif

## ============================================================
## 5) Geant4 HCal tile: 3D scatter + surfaces
## ============================================================
function hits = load_hits(path)
  hits = [];
  if exist(path, "file") ~= 2
    return;
  endif
  d = load_csv(path);
  if columns(d) < 8
    return;
  endif
  ## event,x,y,z,edep,prod,shifted,pe
  ok = isfinite(d(:,5)) & isfinite(d(:,8)) & d(:,5) >= 0 & d(:,5) < 50 & d(:,8) >= 0 & d(:,8) < 1e5;
  hits = d(ok, :);
endfunction

hcal = load_hits(fullfile(root_dir, "sim", "geant4", "hcal_tile_hits.csv"));
if !isempty(hcal)
  x = hcal(:,2); y = hcal(:,3); z = hcal(:,4);
  ed = hcal(:,5); pe = hcal(:,8);

  ## 3D scatter of impact with pe as color via plot3 + stems
  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  ## use plot3 colored by pe: group into bins for multi-series
  edges = linspace(min(pe), max(pe)+1e-6, 6);
  cols = {"b", "c", "g", "y", "r"};
  hold on;
  for k = 1:5
    m = pe >= edges(k) & pe < edges(k+1);
    if any(m)
      plot3(x(m), y(m), ed(m), [cols{k} "o"], "markersize", 4);
    endif
  endfor
  hold off;
  grid on;
  xlabel("x (mm)"); ylabel("y (mm)"); zlabel("E_{dep} (MeV)");
  title("Geant4 HCal tile: impact (x,y) vs E_{dep} (marker color ~ p.e.)");
  view(35, 25);
  legend({"low p.e.", "", "", "", "high p.e."}, "location", "northeastoutside");
  savefig("octave_hcal_scatter_3d", out1, out2);

  ## pe vs edep vs radial index (distance from fiber exit)
  r = sqrt((x - mean(x)).^2 + (y - max(y)).^2);
  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  plot3(ed, r, pe, "ko", "markersize", 4, "markerfacecolor", "b");
  grid on;
  xlabel("E_{dep} (MeV)");
  ylabel("Distance from outer edge (mm)");
  zlabel("N_{p.e.}");
  title("Geant4 HCal S12572: p.e. vs E_{dep} and position (Octave 3D)");
  view(40, 25);
  savefig("octave_hcal_pe_surface_3d", out1, out2);

  ## Interpolated surface Edep(x,y)
  xi = linspace(min(x), max(x), 35);
  yi = linspace(min(y), max(y), 35);
  [XI, YI] = meshgrid(xi, yi);
  try
    ZI = griddata(x, y, ed, XI, YI, "linear");
  catch
    ZI = griddata(x, y, ed, XI, YI);
  end
  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(XI, YI, ZI, "edgecolor", "none");
  colormap("jet");
  colorbar;
  xlabel("x (mm)"); ylabel("y (mm)"); zlabel("E_{dep} (MeV)");
  title("Geant4 HCal tile: E_{dep}(x,y) surface (Octave griddata)");
  view(40, 35);
  savefig("octave_hcal_edep_surf_3d", out1, out2);

  ## p.e. surface
  try
    PI = griddata(x, y, pe, XI, YI, "linear");
  catch
    PI = griddata(x, y, pe, XI, YI);
  end
  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(XI, YI, PI, "edgecolor", "none");
  colormap("hot");
  colorbar;
  xlabel("x (mm)"); ylabel("y (mm)"); zlabel("N_{p.e.}");
  title("Geant4 HCal tile: N_{p.e.}(x,y) surface — S12572 PDE=0.25 (Octave)");
  view(40, 35);
  savefig("octave_hcal_pe_surf_3d", out1, out2);
endif

## Muon3 panel hits if available
m3 = load_hits(fullfile(root_dir, "sim", "geant4", "hits_fresh.csv"));
if isempty(m3)
  m3 = load_hits(fullfile(root_dir, "sim", "geant4", "hits.csv"));
endif
if !isempty(m3) && rows(m3) > 30
  x = m3(:,2); y = m3(:,3); pe = m3(:,8); ed = m3(:,5);
  m = ed > 0 | pe > 0;
  x = x(m); y = y(m); pe = pe(m); ed = ed(m);
  xi = linspace(min(x), max(x), 30);
  yi = linspace(min(y), max(y), 30);
  [XI, YI] = meshgrid(xi, yi);
  try
    PI = griddata(x, y, pe, XI, YI, "linear");
  catch
    PI = griddata(x, y, pe, XI, YI);
  end
  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  surf(XI, YI, PI, "edgecolor", "none");
  colormap("jet");
  colorbar;
  xlabel("x (mm)"); ylabel("y (mm)"); zlabel("N_{p.e.}");
  title("Geant4 Muon3 panel: N_{p.e.}(x,y) surface (Octave 3D)");
  view(35, 30);
  savefig("octave_muon3_pe_surf_3d", out1, out2);

  figure("visible", "off");
  graphics_toolkit(gcf(), "gnuplot");
  plot3(x, y, pe, "o", "markersize", 3, "markerfacecolor", "g");
  grid on;
  xlabel("x (mm)"); ylabel("y (mm)"); zlabel("N_{p.e.}");
  title("Geant4 Muon3 panel: 3D scatter of detected p.e. (Octave)");
  view(40, 25);
  savefig("octave_muon3_scatter_3d", out1, out2);
endif

printf("\nOctave 3D plotting complete.\n");
printf("Paper figures: %s\n", out1);
