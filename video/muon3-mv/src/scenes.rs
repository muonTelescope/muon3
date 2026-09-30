//! The story, one chapter per section of the song. Everything is drawn from the project's own simulation outputs
//! (`data.rs`) and numbers; t is global seconds.
use crate::app;
use crate::data::*;
use crate::*;

/// fade a chapter in over 0.25 s and out over the last 0.12 s
fn vis(t: f32, a: f32, b: f32) -> f32 { seg(t, a, a + 0.25).min(1.0 - seg(t, b - 0.12, b)) }
fn wrap(o: &mut String, t: f32, a: f32, b: f32, body: impl FnOnce(f32) -> String) {
    if t < a - 0.01 || t > b + 0.01 { return; }
    let v = vis(t, a, b);
    w!(o, r#"<g opacity="{v:.3}">{}</g>"#, body(t - a));
}

pub fn scene(t: f32) -> String {
    let mut o = String::new();
    if t < T_VERSE1 { o.push_str(&intro(t)); } else { o.push_str(&rail(t)); }
    wrap(&mut o, t, T_VERSE1, T_PRE, verse1);
    wrap(&mut o, t, T_PRE, T_BREAK, tile);
    wrap(&mut o, t, T_BREAK, T_CHORUS, breakdown);
    wrap(&mut o, t, T_CHORUS, T_QUIET, spice);
    wrap(&mut o, t, T_QUIET, T_VERSE2, bias);
    wrap(&mut o, t, T_VERSE2, T_GAP, heat);
    wrap(&mut o, t, T_GAP, T_EMI, |lt| gap(lt, t));
    wrap(&mut o, t, T_EMI, T_BRIDGE, emi);
    wrap(&mut o, t, T_BRIDGE, T_FINAL, stack);
    wrap(&mut o, t, T_FINAL, T_OUTRO, live);
    wrap(&mut o, t, T_OUTRO, TOTAL + 1.0, outro);
    o
}

// ---------------------------------------------------------------- shared pieces

/// chapter rail along the top: one segment per simulation, the current one filling up
fn rail(t: f32) -> String {
    const CH: [(&str, f32, f32); 7] = [
        ("GEANT4", T_VERSE1, T_BREAK), ("SPICE", T_BREAK, T_QUIET), ("BIAS", T_QUIET, T_VERSE2), ("HEAT", T_VERSE2, T_EMI),
        ("WI-FI", T_EMI, T_BRIDGE), ("STACK", T_BRIDGE, T_FINAL), ("APP", T_FINAL, T_OUTRO),
    ];
    let mut o = String::new();
    let a = seg(t, T_VERSE1 - 0.2, T_VERSE1 + 0.3) * (1.0 - seg(t, T_OUTRO, T_OUTRO + 0.4));
    w!(o, r#"<g opacity="{a:.2}">"#);
    for (i, (name, s, e)) in CH.iter().enumerate() {
        let x = 96.0 + i as f32 * 248.0; let p = seg(t, *s, *e);
        let col = if p >= 1.0 { LILAC } else if p > 0.0 { PHOSPHOR } else { MUTED };
        w!(o, r#"{}<path d="{}" fill="{RAISED}" stroke="{HAIRLINE}" stroke-width="1" /><rect x="{x}" y="60" width="{:.1}" height="8" fill="{}" />"#,
            mono(x, 50.0, 18.0, col, "start", 3.0, &format!("0{} {}", i + 1, name)), chamfer4(x, 60.0, 232.0, 8.0, 3.0), (232.0 * p).max(0.5), if p >= 1.0 { BRIGHT_EDGE } else { PHOSPHOR });
    }
    w!(o, "</g>");
    o
}

/// Muo, the muon: a glowing orb in a knitted hat, bouncing on the beat
fn muo(x: f32, y: f32, s: f32, t: f32, look: (f32, f32)) -> String {
    let y = y - 12.0 * s * kick(t);
    let blink = if (t * 0.8 + 0.3) % 3.3 < 0.12 { 0.15 } else { 1.0 };
    let mut o = String::new();
    w!(o, r#"<circle cx="{x:.1}" cy="{y:.1}" r="{:.1}" fill="url(#glow)" opacity="0.55" />"#, 78.0 * s);
    w!(o, r#"<circle cx="{x:.1}" cy="{y:.1}" r="{:.1}" fill="url(#orb)" stroke="{MINT}" stroke-width="{:.1}" />"#, 38.0 * s, 2.5 * s);
    for sx in [-1.0f32, 1.0] {
        let ex = x + sx * 13.0 * s; let ey = y - 2.0 * s;
        w!(o, r#"<ellipse cx="{ex:.1}" cy="{ey:.1}" rx="{:.1}" ry="{:.1}" fill="{BUTTON_INK}" /><circle cx="{:.1}" cy="{:.1}" r="{:.1}" fill="&#35;FFFFFF" />"#,
            6.0 * s, 9.0 * s * blink, ex + look.0 * 2.0 * s - 1.6 * s, ey + look.1 * 2.0 * s - 2.6 * s, 2.2 * s);
        w!(o, r#"<circle cx="{:.1}" cy="{:.1}" r="{:.1}" fill="{PINK}" opacity="0.5" />"#, x + sx * 25.0 * s, y + 10.0 * s, 6.0 * s);
    }
    w!(o, r#"<path d="M{:.1} {:.1} Q{x:.1} {:.1} {:.1} {:.1}" fill="none" stroke="{BUTTON_INK}" stroke-width="{:.1}" stroke-linecap="round" />"#, x - 9.0 * s, y + 13.0 * s, y + 24.0 * s, x + 9.0 * s, y + 13.0 * s, 2.6 * s);
    // the beanie: band, body with a Fair Isle stripe, pompom
    w!(o, r#"<path d="M{:.1} {:.1} Q{x:.1} {:.1} {:.1} {:.1} Z" fill="{VIOLET}" />"#, x - 33.0 * s, y - 20.0 * s, y - 84.0 * s, x + 33.0 * s, y - 20.0 * s);
    w!(o, r#"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" fill="{PINK}" /><rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" fill="{BRIGHT_EDGE}" />"#,
        x - 35.0 * s, y - 29.0 * s, 70.0 * s, 10.0 * s, x - 25.0 * s, y - 48.0 * s, 50.0 * s, 6.0 * s);
    w!(o, r#"<circle cx="{x:.1}" cy="{:.1}" r="{:.1}" fill="{MINT}" />"#, y - 70.0 * s, 8.0 * s);
    o
}

fn sim_chip(x: f32, y: f32, label: &str, col: &str) -> String { chip(x, y, label, col, 1.0) }

// ---------------------------------------------------------------- 0:00 intro

fn intro(t: f32) -> String {
    let mut o = String::new();
    let a = seg(t, 0.4, 1.6) * (1.0 - seg(t, 2.6, 2.857));
    o.push_str(&format!(r#"<g opacity="{a:.2}">{}</g>"#, mono(960.0, 520.0, 38.0, LILAC, "middle", 30.0, "NORDLYS")));
    if t >= 2.857 {
        let p = pop_in(seg(t, 2.857, 3.45)); let s = lerp(1.7, 1.0, p);
        w!(o, r#"<g transform="translate(960 560) scale({s:.3}) translate(-960 -560)" opacity="{:.2}">{}</g>"#, seg(t, 2.857, 3.0), pop(960.0, 560.0, 300.0, "middle", t, "MUON3"));
    }
    if t >= 5.714 {
        let a = seg(t, 5.714, 6.1);
        w!(o, r#"<g opacity="{a:.2}">{}</g>"#, mono(960.0, 650.0, 30.0, MINT, "middle", 8.0, "A COSMIC-RAY POP SONG"));
    }
    // the journey, lit one stop per beat
    const STOPS: [&str; 7] = ["GEANT4", "SPICE", "BIAS", "HEAT", "WI-FI", "STACK", "APP"];
    if t >= 7.143 {
        let mut x = 330.0;
        for (i, s) in STOPS.iter().enumerate() {
            let at = 7.143 + i as f32 * B * 0.5; let p = pop_in(seg(t, at, at + 0.4));
            let wd = 34.0 + s.len() as f32 * 13.2;
            w!(o, r#"<g transform="translate({:.1} 740) scale({:.3}) translate({:.1} -740)" opacity="{:.2}">{}</g>"#, x + wd / 2.0, p, -(x + wd / 2.0), seg(t, at, at + 0.1), sim_chip(x, 720.0, s, if i == 6 { PHOSPHOR } else { LILAC }));
            x += wd + 26.0;
        }
    }
    // Muo arrives, looks up; a streak from the sky is about to hit
    if t >= 8.57 {
        let x = lerp(2100.0, 1560.0, eo(seg(t, 8.57, 9.6)));
        w!(o, "{}", muo(x, 868.0, 1.25, t, (0.0, -1.0)));
    }
    if t >= 9.8 {
        let p = seg(t, 9.8, T_VERSE1);
        let (x0, y0, x1, y1) = (1000.0, -50.0, 1000.0 + 560.0 * p, -50.0 + 880.0 * p);
        w!(o, r#"<line x1="{x0}" y1="{y0}" x2="{x1:.0}" y2="{y1:.0}" stroke="{PHOSPHOR}" stroke-width="10" opacity="0.5" filter="url(#soft)" /><line x1="{x0}" y1="{y0}" x2="{x1:.0}" y2="{y1:.0}" stroke="{INK}" stroke-width="3" />"#);
    }
    o
}

// ---------------------------------------------------------------- verse 1: Geant4

struct Sg { x0: f32, y0: f32, x1: f32, y1: f32, depth: u32, birth: f32 }
fn shower(x: f32, y: f32, ang: f32, len: f32, depth: u32, birth: f32, ctr: &mut u32, out: &mut Vec<Sg>) {
    let (x1, y1) = (x + ang.cos() * len, (y + ang.sin() * len).min(872.0));
    out.push(Sg { x0: x, y0: y, x1, y1, depth, birth });
    if depth >= 5 || y1 >= 872.0 { return; }
    *ctr += 1;
    let n = 2 + (hash(*ctr) > 0.55) as u32;
    for _ in 0..n {
        *ctr += 1;
        let a = (ang + (hash(*ctr) - 0.5) * 1.3).clamp(0.55, 2.6);
        shower(x1, y1, a, len * (0.66 + 0.2 * hash(*ctr + 9)), depth + 1, birth + 0.42 + 0.2 * hash(*ctr + 5), ctr, out);
    }
}

fn verse1(lt: f32) -> String {
    let t = lt + T_VERSE1;
    let mut o = String::new();
    let (ax, ay, gx, gy) = (1200.0f32, 190.0f32, 1150.0f32, 880.0f32);
    // altitude scale
    for (i, km) in [15, 10, 5, 0].iter().enumerate() {
        let y = ay + (gy - ay) * i as f32 / 3.0;
        w!(o, r#"<rect x="1560" y="{y:.0}" width="36" height="2" fill="{BRIGHT_EDGE}" />{}"#, mono(1610.0, y + 7.0, 20.0, MUTED, "start", 2.0, &format!("{km} KM")));
    }
    // the primary
    let p = eo(seg(lt, 0.2, 1.3));
    let (px, py) = (lerp(760.0, ax, p), lerp(-40.0, ay, p));
    w!(o, r#"<line x1="760" y1="-40" x2="{px:.0}" y2="{py:.0}" stroke="{PINK}" stroke-width="6" opacity="0.5" filter="url(#soft)" /><line x1="760" y1="-40" x2="{px:.0}" y2="{py:.0}" stroke="{INK}" stroke-width="3" />"#);
    w!(o, "{}", mono(790.0, 110.0, 22.0, PINK, "start", 4.0, "COSMIC RAY"));
    // the cascade
    let mut segs = Vec::new(); let mut ctr = 0u32;
    shower(ax, ay, 1.45, 235.0, 0, 1.2, &mut ctr, &mut segs);
    for s in &segs {
        let r = seg(lt, s.birth, s.birth + 0.45);
        if r <= 0.0 { continue; }
        let w = (3.4 - s.depth as f32 * 0.5).max(1.0);
        w!(o, r#"<line x1="{:.0}" y1="{:.0}" x2="{:.0}" y2="{:.0}" stroke="{}" stroke-width="{w:.1}" opacity="{:.2}" />"#,
            s.x0, s.y0, lerp(s.x0, s.x1, r), lerp(s.y0, s.y1, r), if s.depth % 2 == 0 { LILAC } else { VIOLET }, 0.25 + 0.4 * r);
    }
    // the muon (Muo) falls straight through to the tile
    let q = seg(lt, 2.8, 8.4);
    let (mx, my) = (lerp(ax, gx, q), lerp(ay, gy, q));
    if q > 0.0 {
        w!(o, r#"<line x1="{ax}" y1="{ay}" x2="{mx:.0}" y2="{my:.0}" stroke="{PHOSPHOR}" stroke-width="12" opacity="0.35" filter="url(#soft)" /><line x1="{ax}" y1="{ay}" x2="{mx:.0}" y2="{my:.0}" stroke="{MINT}" stroke-width="3.5" />"#);
    }
    // the tile, edge-on
    let hit = seg(lt, 8.4, 9.4);
    w!(o, r#"<path d="{}" fill="{RAISED}" stroke="{}" stroke-width="3" />{}"#, chamfer4(gx - 190.0, gy, 380.0, 22.0, 6.0), if hit > 0.0 { PHOSPHOR } else { BRIGHT_EDGE },
        mono(gx - 210.0, gy + 17.0, 18.0, MUTED, "end", 2.0, "TILE 01 · EJ200 · 7 MM"));
    if hit > 0.0 {
        w!(o, r#"<ellipse cx="{gx}" cy="{gy}" rx="{:.0}" ry="{:.0}" fill="none" stroke="{PHOSPHOR}" stroke-width="3" opacity="{:.2}" />"#, 40.0 + 260.0 * eo(hit), 10.0 + 40.0 * eo(hit), 1.0 - hit);
    }
    if lt >= 2.8 { w!(o, "{}", muo(if q < 1.0 { mx } else { gx }, if q < 1.0 { my } else { gy - 34.0 }, 0.85, t, (0.0, 1.0))); }
    // title and three facts
    w!(o, "{}", pop(96.0, 250.0, 120.0, "start", t, "GEANT4"));
    w!(o, "{}", mono(100.0, 300.0, 22.0, MUTED, "start", 4.0, "ONE MUON, SIMULATED PHOTON BY PHOTON"));
    let rows = ["Cosmic rays hit the air about 15 km up", "Muons arrive nearly vertical: cos squared", "About 1.5 MeV lost in 7 mm of tile"];
    for (k, r) in rows.iter().enumerate() {
        let at = 1.0 + k as f32 * 2.0 * BAR; let p = pop_in(seg(lt, at, at + 0.5)); if p <= 0.0 { continue; }
        let y = 350.0 + k as f32 * 112.0;
        w!(o, r#"<g transform="translate(0 {:.1})" opacity="{:.2}"><path d="{}" fill="{RAISED}" stroke="{HAIRLINE}" stroke-width="1.5" /><circle cx="140" cy="{:.0}" r="11" fill="{PHOSPHOR}" />{}</g>"#,
            (1.0 - p) * 40.0, seg(lt, at, at + 0.2), chamfer(96.0, y, 640.0, 88.0, 14.0), y + 44.0, txt(168.0, y + 55.0, 29.0, 600, INK, "start", r));
    }
    o
}

// ---------------------------------------------------------------- pre-chorus: the tile

fn tile(lt: f32) -> String {
    let t = lt + T_PRE;
    let mut o = String::new();
    let (cx, cy, s) = (560.0f32, 540.0f32, 3.6f32);
    let map = |p: [f32; 2]| (cx + p[0] * s, cy - p[1] * s);
    let hull: String = TILE01_HULL.iter().enumerate().map(|(i, p)| { let (x, y) = map(*p); format!("{}{x:.1} {y:.1} ", if i == 0 { "M" } else { "L" }) }).collect::<String>() + "Z";
    w!(o, r#"<path d="{hull}" fill="{PANEL}" stroke="{BRIGHT_EDGE}" stroke-width="3" />"#);
    let fpts: Vec<(f32, f32)> = TILE01_FIBER.iter().map(|p| map(*p)).collect();
    let fpath: String = fpts.iter().enumerate().map(|(i, (x, y))| format!("{}{x:.1} {y:.1} ", if i == 0 { "M" } else { "L" })).collect();
    w!(o, r#"<path d="{fpath}" fill="none" stroke="{VIOLET}" stroke-width="9" opacity="0.35" filter="url(#soft)" /><path d="{fpath}" fill="none" stroke="{LILAC}" stroke-width="2.5" />"#);
    let (sx, sy) = fpts[0];
    let mut flash = 0.0f32;
    // a muon every two beats: a burst of blue photons, some absorbed by the fiber and re-emitted along it to the SiPM
    let ev = 2.0 * B; let m0 = (lt / ev).floor() as i32;
    for m in (m0 - 2).max(0)..=m0 {
        let ph = lt - m as f32 * ev; if ph < 0.0 { continue; }
        let id = m as u32 * 131 + 7;
        let (hx, hy) = (cx + (hash(id) - 0.5) * 40.0 * s, cy + (hash(id + 1) - 0.5) * 90.0 * s);
        if ph < 0.6 {
            w!(o, r#"<circle cx="{hx:.0}" cy="{hy:.0}" r="{:.0}" fill="none" stroke="{MINT}" stroke-width="3" opacity="{:.2}" />"#, 10.0 + 120.0 * eo(ph / 0.5), 1.0 - ph / 0.6);
        }
        for k in 0..26u32 {
            let a = hash(id + k * 3 + 2) * std::f32::consts::TAU;
            if k < 8 {
                // absorbed: fly to a point of the fiber, then travel along it toward an end
                let idx = (hash(id + k * 7 + 40) * (fpts.len() - 2) as f32) as usize + 1;
                let (fx, fy) = fpts[idx];
                let fly = seg(ph, 0.0, 0.3);
                if ph < 0.3 { w!(o, r#"<circle cx="{:.0}" cy="{:.0}" r="5.5" fill="{MINT}" opacity="0.95" />"#, lerp(hx, fx, eo(fly)), lerp(hy, fy, eo(fly))); continue; }
                let dir = if hash(id + k + 90) > 0.5 { 1.0f32 } else { -1.0 };
                let dist = if dir > 0.0 { (fpts.len() - 1 - idx) as f32 } else { idx as f32 };
                let tr = seg(ph, 0.3, 1.05); let pos = idx as f32 + dir * dist * tr;
                let i = (pos.round() as usize).min(fpts.len() - 1);
                if tr < 1.0 { w!(o, r#"<circle cx="{:.1}" cy="{:.1}" r="14" fill="{PHOSPHOR}" opacity="0.35" /><circle cx="{:.1}" cy="{:.1}" r="6" fill="{PHOSPHOR}" />"#, fpts[i].0, fpts[i].1, fpts[i].0, fpts[i].1); }
                else { flash = flash.max(1.0 - (ph - 1.05) / 0.25); }
            } else if ph < 0.55 {
                let r = 240.0 * eo(ph / 0.55) * (0.4 + hash(id + k));
                w!(o, r#"<circle cx="{:.0}" cy="{:.0}" r="4.2" fill="{LILAC}" opacity="{:.2}" />"#, hx + a.cos() * r, hy + a.sin() * r, 1.0 - ph / 0.55);
            }
        }
    }
    w!(o, r#"<rect x="{:.0}" y="{:.0}" width="22" height="22" fill="{PHOSPHOR}" />{}"#, sx - 11.0, sy - 11.0, mono(sx + 26.0, sy - 14.0, 18.0, PHOSPHOR, "start", 3.0, "SiPM"));
    if flash > 0.0 { w!(o, "{}", sparkle(sx, sy, 36.0 + 40.0 * flash, MINT, flash)); }
    // title and funnel
    w!(o, "{}{}", pop(1040.0, 250.0, 104.0, "start", t, "ONE MUON"), pop(1040.0, 350.0, 104.0, "start", t, "36 FLASHES"));
    w!(o, "{}", card(1040.0, 420.0, 784.0, 420.0, BRIGHT_EDGE, 1.0));
    w!(o, "{}", mono(1074.0, 462.0, 20.0, MUTED, "start", 3.0, "GEANT4 · PER GENERATED MUON"));
    let rows: [(&str, f32); 5] = [("scintillation photons", 13100.0), ("absorbed by the fiber", 2540.0), ("re-emitted", 2320.0), ("reach the SiPM", 156.0), ("detected", 33.0)];
    for (k, (name, n)) in rows.iter().enumerate() {
        let at = 0.7 + k as f32 * BAR; let p = seg(lt, at, at + 0.9); if p <= 0.0 { continue; }
        let y = 490.0 + k as f32 * 66.0; let full = 13100.0f32.ln();
        let bw = 440.0 * (n.ln() / full) * eo(p);
        let col = if k == 4 { PHOSPHOR } else { VIOLET };
        w!(o, r#"<rect x="1074" y="{:.0}" width="{bw:.0}" height="10" fill="{col}" />{}{}"#, y + 34.0, txt(1074.0, y + 22.0, 24.0, 600, INK, "start", name),
            mono(1792.0, y + 30.0, 34.0, if k == 4 { PHOSPHOR } else { INK }, "end", 0.0, &group_sp((n * eo(p)).round() as i64)));
    }
    let big = pop_in(seg(lt, 7.9, 8.5));
    if big > 0.0 {
        w!(o, r#"<g transform="translate(1040 940) scale({big:.3}) translate(-1040 -940)">{}{}</g>"#, pop(1040.0, 940.0, 130.0, "start", t, "36.6 p.e."),
            mono(1040.0, 990.0, 22.0, MINT, "start", 3.0, "PER CROSSING MUON · SIGMA 13.3 · MIN 15"));
    }
    o
}

// ---------------------------------------------------------------- break: one photon, one pulse

fn breakdown(lt: f32) -> String {
    let t = lt + T_BREAK;
    let mut o = String::new();
    let b = (lt / BAR) as usize;
    let (big, small) = match b { 0 => ("1 p.e.", "ONE PHOTOELECTRON"), 1 => ("5.8 mV", "TRANSIMPEDANCE GAIN, PER PHOTOELECTRON"), _ => ("x 36.6 = 209 mV", "THE MEAN MUON PULSE") };
    let ph = lt - b as f32 * BAR; let p = pop_in(seg(ph, 0.0, 0.5));
    let size = if b >= 2 { 150.0 } else { 220.0 };
    w!(o, r#"<g transform="translate(960 560) scale({p:.3}) translate(-960 -560)">{}</g>"#, pop(960.0, 560.0, size, "middle", t, big));
    w!(o, "{}", mono(960.0, 640.0, 26.0, MINT, "middle", 6.0, small));
    // a single photon: one tiny spark that becomes a pulse
    let sp = 0.4 + 0.6 * kick(t);
    w!(o, "{}", sparkle(960.0, 330.0, 60.0 * sp + 12.0 * b as f32, [PHOSPHOR, LILAC, PINK][b.min(2)], 0.95));
    // count-in to the drop: four dots in the last bar
    if b >= 2 {
        for i in 0..4 { let on = ph >= i as f32 * B; w!(o, r#"<circle cx="{}" cy="760" r="14" fill="{}" opacity="{}" />"#, 960.0 - 90.0 + i as f32 * 60.0, if on { PHOSPHOR } else { HAIRLINE }, if on { 1.0 } else { 0.7 }); }
    }
    o
}

// ---------------------------------------------------------------- chorus: ngspice

fn spice(lt: f32) -> String {
    let t = lt + T_CHORUS;
    let mut o = String::new();
    let (x0, xw, yb) = (150.0f32, 1076.0f32, 560.0f32);
    let n = (lt / BAR).floor() as i32; let ph = lt - n as f32 * BAR;
    let pe = |k: i32| -> f32 { if k == 0 { 36.6 } else { let g = (0..4).map(|j| hash(k as u32 * 17 + j)).sum::<f32>() - 2.0; (36.6 + 13.3 * g * 1.73).max(15.0) } };
    w!(o, "{}", card(96.0, 150.0, 1180.0, 700.0, BRIGHT_EDGE, 1.0));
    w!(o, "{}", mono(130.0, 196.0, 20.0, MUTED, "start", 3.0, "NGSPICE · TIA + COMPARATOR · ONE PULSE PER BAR"));
    // grid
    for i in 0..=8 { let x = x0 + xw * i as f32 / 8.0; w!(o, r#"<rect x="{x:.0}" y="230" width="1" height="560" fill="{HAIRLINE}" />"#); }
    w!(o, r#"<rect x="{x0}" y="{yb}" width="{xw}" height="2" fill="{BRIGHT_EDGE}" />"#);
    // threshold: 5 p.e. = 29 mV
    let ty = yb - 29.0 * 1.45;
    w!(o, r#"<rect x="{x0}" y="{ty:.0}" width="{xw}" height="2" fill="{LILAC}" opacity="0.8" stroke-dasharray="10 8" />{}"#, mono(x0 + xw - 6.0, ty - 10.0, 18.0, LILAC, "end", 2.0, "THRESHOLD 29 mV"));
    w!(o, "{}{}", mono(x0 - 12.0, yb + 6.0, 18.0, MUTED, "end", 1.0, "0"), mono(x0 - 12.0, yb - 209.0 * 1.45 + 6.0, 18.0, MUTED, "end", 1.0, "209"));
    // ghosts of earlier pulses (scope persistence), then the current sweep
    let pts = |k: i32, cursor: f32| -> (String, String, Option<f32>) {
        let a = pe(k) / 36.6; let mut tia = String::new(); let mut cmp = String::new(); let mut cross = None;
        for (i, p) in PULSE.iter().enumerate() {
            if p[0] > cursor { break; }
            let mv = p[1] * a; let hit = mv > 29.0;
            if hit && cross.is_none() { cross = Some(p[0]); }
            let x = x0 + xw * p[0] / 560.0;
            w!(tia, "{}{:.1} {:.1} ", if i == 0 { "M" } else { "L" }, x, yb - mv * 1.45);
            w!(cmp, "{}{:.1} {:.1} ", if i == 0 { "M" } else { "L" }, x, if hit { 650.0 } else { 760.0 });
        }
        (tia, cmp, cross)
    };
    for g in 1..=3 {
        let k = n - g; if k < 0 { continue; }
        let (tia, cmp, _) = pts(k, 560.0);
        w!(o, r#"<path d="{tia}" fill="none" stroke="{PHOSPHOR}" stroke-width="2" opacity="{:.2}" /><path d="{cmp}" fill="none" stroke="{LILAC}" stroke-width="2" opacity="{:.2}" />"#, 0.22 / g as f32, 0.22 / g as f32);
    }
    let cursor = 560.0 * seg(ph, 0.0, 0.95);
    let (tia, cmp, cross) = pts(n, cursor);
    w!(o, r#"<path d="{tia}" fill="none" stroke="{PHOSPHOR}" stroke-width="10" opacity="0.35" filter="url(#soft)" /><path d="{tia}" fill="none" stroke="{PHOSPHOR}" stroke-width="3.5" /><path d="{cmp}" fill="none" stroke="{LILAC}" stroke-width="3.5" />"#);
    w!(o, r#"<rect x="{:.0}" y="230" width="2" height="560" fill="{INK}" opacity="0.4" />"#, x0 + xw * cursor / 560.0);
    // 12.5 ns ESP32 time stamps
    for i in 0..=44 { let x = x0 + xw * (i as f32 * 12.5) / 560.0; w!(o, r#"<rect x="{x:.1}" y="796" width="2" height="{}" fill="{}" />"#, if i % 4 == 0 { 18 } else { 10 }, BRIGHT_EDGE); }
    w!(o, "{}", mono(x0, 836.0, 18.0, MUTED, "start", 3.0, "ESP32 TIMESTAMPS · 12.5 NS PER TICK"));
    if let Some(c) = cross { let tick = (c / 12.5).ceil(); let x = x0 + xw * tick * 12.5 / 560.0;
        w!(o, r#"<rect x="{x:.1}" y="786" width="4" height="34" fill="{PHOSPHOR}" />{}"#, mono(x + 14.0, 812.0, 22.0, PHOSPHOR, "start", 2.0, &format!("tick {} = {:.1} ns", tick as i32, tick * 12.5))); }
    w!(o, "{}", mono(x0 + xw, 196.0, 22.0, PHOSPHOR, "end", 3.0, &format!("{:.0} p.e.", pe(n))));
    // stat cards
    let stats: [(&str, &str, f32); 4] = [("MEAN MUON PULSE", "209 mV", 0.3), ("5 p.e. THRESHOLD", "29 mV", 2.0 * BAR), ("OVER THRESHOLD", "370 ns", 4.0 * BAR), ("ESP32 TICK", "12.5 ns", 6.0 * BAR)];
    for (k, (l, v, at)) in stats.iter().enumerate() {
        let p = pop_in(seg(lt, *at, at + 0.5)); if p <= 0.0 { continue; }
        let y = 150.0 + k as f32 * 172.0;
        w!(o, r#"<g transform="translate({:.1} 0)" opacity="{:.2}">{}{}{}</g>"#, (1.0 - p) * 120.0, seg(lt, *at, at + 0.2), card(1316.0, y, 508.0, 154.0, if k == (lt / (3.0 * BAR)) as usize { PHOSPHOR } else { HAIRLINE }, 1.0),
            mono(1350.0, y + 50.0, 20.0, MUTED, "start", 3.0, l), mono(1350.0, y + 122.0, 70.0, if k == 1 { LILAC } else { PHOSPHOR }, "start", 0.0, v));
    }
    // three tiles, one coincidence window
    if lt >= 6.0 * BAR {
        let p = seg(lt, 6.0 * BAR, 6.0 * BAR + 0.4);
        w!(o, r#"<g opacity="{p:.2}">{}{}"#, card(96.0, 870.0, 1728.0, 130.0, HAIRLINE, 1.0), mono(130.0, 916.0, 20.0, MUTED, "start", 3.0, "3 TILES · COINCIDENCE WINDOW"));
        let cyc = (lt / BAR).fract();
        for (i, name) in ["TILE 1", "TILE 2", "TILE 3"].iter().enumerate() {
            let x = 620.0 + i as f32 * 340.0; let on = cyc > 0.1 + 0.05 * i as f32 && cyc < 0.6;
            w!(o, r#"<path d="{}" fill="{}" stroke="{}" stroke-width="2" />{}"#, chamfer4(x, 900.0, 290.0, 76.0, 8.0), if on { "#1F4A38" } else { RAISED }, if on { PHOSPHOR } else { HAIRLINE }, mono(x + 145.0, 947.0, 26.0, if on { PHOSPHOR } else { MUTED }, "middle", 4.0, name));
        }
        w!(o, "</g>");
    }
    w!(o, "{}", pop(1570.0, 130.0, 54.0, "end", t, "TIME IT RIGHT"));
    o
}

// ---------------------------------------------------------------- quiet: the SiPM bias

fn bias(lt: f32) -> String {
    let t = lt + T_QUIET;
    let mut o = String::new();
    let v = 5.0 + 78.0 * eo(seg(lt, 0.2, 2.0));
    w!(o, "{}", mono(960.0, 360.0, 28.0, MINT, "middle", 6.0, "USB 5 V  →  MC34063 BOOST  →  SiPM BIAS"));
    w!(o, "{}", pop(960.0, 560.0, 220.0, "middle", t, &format!("{v:.1} V")));
    let (bx, bw) = (360.0f32, 1200.0f32);
    w!(o, r#"<path d="{}" fill="{RAISED}" stroke="{HAIRLINE}" stroke-width="1.5" /><rect x="{bx}" y="660" width="{:.0}" height="20" fill="{PHOSPHOR}" /><rect x="{:.0}" y="648" width="{:.0}" height="44" fill="none" stroke="{LILAC}" stroke-width="2" />"#,
        chamfer4(bx, 660.0, bw, 20.0, 5.0), bw * v / 90.0, bx + bw * 52.9 / 90.0, bw * (83.0 - 52.9) / 90.0);
    w!(o, "{}", mono(bx + bw * 52.9 / 90.0, 730.0, 20.0, LILAC, "start", 3.0, "52.9 – 83.0 V WORKING RANGE"));
    o
}

// ---------------------------------------------------------------- verse 2: heat

fn heat_color(v: f32) -> &'static str {
    let v = ((v - 0.3) / 0.7).clamp(0.0, 1.0);
    const C: [&str; 10] = ["#1C1628", "#2B2142", "#3E2F63", "#5E4A93", "#7C62C8", "#9B7BFF", "#C58BE0", "#FF8FB1", "#FFB7C8", "#FFF0EB"];
    C[((v * 9.0).round() as usize).min(9)]
}
fn heat(lt: f32) -> String {
    let t = lt + T_VERSE2;
    let mut o = String::new();
    let warm = ss(seg(lt, 0.2, 4.6));
    w!(o, "{}{}", pop(96.0, 290.0, 130.0, "start", t, "WARM BOARD"), mono(100.0, 340.0, 22.0, MUTED, "start", 4.0, "THERMAL MODEL · 337 × 40 MM · ESP32 WI-FI ON"));
    let (x0, y0, c) = (120.0f32, 420.0f32, 10.0f32);
    let (mut hot, mut hv) = ((0usize, 0usize), 0u8);
    for (r, row) in THERMAL.iter().enumerate() {
        let mut run_start = 0usize;
        for k in 0..=row.len() {
            let lvl = |j: usize| -> i32 { if row[j] == 255 { -1 } else { ((row[j] as f32 / 250.0 * warm * 9.0).round()) as i32 } };
            if k < row.len() && (row[k] < 255) && row[k] > hv { hv = row[k]; hot = (r, k); }
            if k == row.len() || lvl(k) != lvl(run_start) {
                let l = lvl(run_start);
                if l >= 0 { w!(o, r#"<rect x="{:.0}" y="{:.0}" width="{:.0}" height="{}" fill="{}" />"#, x0 + run_start as f32 * c, y0 + r as f32 * c, (k - run_start) as f32 * c + 0.6, c + 0.6, heat_color(l as f32 / 9.0)); }
                run_start = k;
            }
        }
    }
    w!(o, r#"<path d="{}" fill="none" stroke="{LILAC}" stroke-width="3" />"#, chamfer4(x0 - 4.0, y0 - 4.0, 1688.0, 208.0, 12.0));
    let (hx, hy) = (x0 + hot.1 as f32 * c + 5.0, y0 + hot.0 as f32 * c + 5.0);
    if lt > 4.0 { let p = seg(lt, 4.0, 4.5); w!(o, r#"<g opacity="{p:.2}"><path d="M{hx:.0} {:.0} L{hx:.0} {:.0}" stroke="{INK}" stroke-width="3" />{}</g>"#, y0 - 4.0, hy, mono(hx, y0 - 22.0, 22.0, INK, "middle", 3.0, &format!("HOT SPOT +{:.1} K", THERMAL_MAX_K))); }
    let cards: [(&str, String, &str, f32); 3] = [("WI-FI ON", format!("+{:.1} K", THERMAL_MAX_K), "board maximum", 1.0), ("BME280 SENSOR", format!("+{:.1} K", THERMAL_BME_K), "own vented chamber", 1.0 + BAR), ("LOW-POWER MODE", "+4.8 K".to_string(), "BME280 offset", 1.0 + 2.0 * BAR)];
    for (k, (l, v, sub, at)) in cards.iter().enumerate() {
        let p = pop_in(seg(lt, *at, at + 0.5)); if p <= 0.0 { continue; }
        let x = 120.0 + k as f32 * 572.0;
        w!(o, r#"<g transform="translate(0 {:.1})" opacity="{:.2}">{}{}{}{}</g>"#, (1.0 - p) * 50.0, seg(lt, *at, at + 0.2), card(x, 690.0, 544.0, 200.0, if k == 1 { PHOSPHOR } else { HAIRLINE }, 1.0),
            mono(x + 30.0, 742.0, 20.0, MUTED, "start", 3.0, l), mono(x + 30.0, 830.0, 84.0, if k == 0 { PINK } else { PHOSPHOR }, "start", 0.0, v), txt(x + 32.0, 868.0, 24.0, 600, MUTED, "start", sub));
    }
    w!(o, "{}", muo(1720.0, 330.0, 1.0, t, (-1.0, 0.5)));
    o
}

fn gap(lt: f32, t: f32) -> String {
    let mut o = String::new();
    for k in 0..4u32 {
        let j = hash(k + (t * 24.0) as u32 * 5) * 2.0 - 1.0;
        w!(o, "{}", pop(960.0 + j * 40.0 * kick(t), 600.0 + k as f32 * 4.0 * j, 260.0, "middle", t, "WI-FI"));
        if k == 0 { break; }
    }
    w!(o, "{}", mono(960.0, 690.0, 28.0, MINT, "middle", 8.0, "+20 dBm · 100 mW · RIGHT NEXT TO THE ELECTRONICS"));
    let _ = lt;
    o
}

// ---------------------------------------------------------------- Wi-Fi interference

fn emi(lt: f32) -> String {
    let t = lt + T_EMI;
    let mut o = String::new();
    let (ax, ay) = (1560.0f32, 420.0f32);
    for i in 0..6u32 {
        let r = ((lt * 330.0 + i as f32 * 150.0) % 900.0).max(1.0);
        w!(o, r#"<circle cx="{ax}" cy="{ay}" r="{r:.0}" fill="none" stroke="{}" stroke-width="3" opacity="{:.2}" />"#, if i % 2 == 0 { LILAC } else { PINK }, 0.7 * (1.0 - r / 900.0));
    }
    // the board strip with its four TIA inputs
    w!(o, r#"<path d="{}" fill="{PANEL}" stroke="{LILAC}" stroke-width="2.5" />"#, chamfer4(300.0, 400.0, 1290.0, 40.0, 8.0));
    w!(o, "{}", mono(300.0, 384.0, 18.0, MUTED, "start", 3.0, "BOARD · 4 TIA INPUTS"));
    w!(o, r#"<circle cx="{ax}" cy="{ay}" r="16" fill="{PHOSPHOR}" /><line x1="{ax}" y1="{ay}" x2="{ax}" y2="300" stroke="{PHOSPHOR}" stroke-width="5" />{}"#, mono(ax, 280.0, 20.0, PHOSPHOR, "middle", 4.0, "ANTENNA"));
    w!(o, "{}{}", pop(96.0, 250.0, 120.0, "start", t, "WI-FI"), mono(100.0, 300.0, 22.0, MUTED, "start", 4.0, "OPENEMS · +20 dBm AT THE ANTENNA"));
    let vals = [0.91f32, 1.59, 9.33, 1.08];
    let (by, sc) = (930.0f32, 8.0f32);
    let thr = by - 29.0 * sc;
    w!(o, r#"<rect x="300" y="{thr:.0}" width="1290" height="2" fill="{LILAC}" stroke-dasharray="10 8" />{}"#, mono(300.0, thr - 12.0, 20.0, LILAC, "start", 3.0, "SIGNAL THRESHOLD 29 mV"));
    for (i, v) in vals.iter().enumerate() {
        let at = 1.5 + i as f32 * 0.5; let p = eo(seg(lt, at, at + 0.9));
        let x = 380.0 + i as f32 * 300.0; let h = v * sc * p;
        w!(o, r#"<rect x="{:.0}" y="440" width="2" height="{:.0}" fill="{HAIRLINE}" /><path d="{}" fill="{}" />{}{}"#, x + 70.0, by - 440.0, chamfer4(x, by - h.max(3.0), 140.0, h.max(3.0), 4.0), if i == 2 { PINK } else { PHOSPHOR },
            mono(x + 70.0, by + 34.0, 22.0, MUTED, "middle", 3.0, &format!("TIA {i}")), mono(x + 70.0, by - h - 14.0, 30.0, INK, "middle", 0.0, &format!("{:.1} mV", v * p)));
    }
    if lt > 5.0 { let p = seg(lt, 5.0, 5.4); w!(o, "<g opacity=\"{p:.2}\">{}</g>", txt(1590.0, 730.0, 34.0, 700, INK, "end", "Worst input 9.3 mV: a third of the threshold")); }
    o
}

// ---------------------------------------------------------------- bridge: twelve tiles

fn stack(lt: f32) -> String {
    let t = lt + T_BRIDGE;
    let mut o = String::new();
    w!(o, "{}{}", pop(96.0, 250.0, 110.0, "start", t, "PICK A TILE"), mono(100.0, 300.0, 22.0, MUTED, "start", 4.0, "768 GEOMETRIES × 200 000 MUONS · 3 TILES 100 MM APART"));
    let hulls: [&[[f32; 2]]; 12] = [&HULL_01, &HULL_02, &HULL_03, &HULL_04, &HULL_05, &HULL_06, &HULL_07, &HULL_08, &HULL_09, &HULL_10, &HULL_11, &HULL_12];
    for (i, h) in hulls.iter().enumerate() {
        let (col, row) = (i % 6, i / 6);
        let at = 0.1 + i as f32 * 0.09; let p = pop_in(seg(lt, at, at + 0.4)); if p <= 0.0 { continue; }
        let (x, y) = (126.0 + col as f32 * 284.0, 340.0 + row as f32 * 330.0);
        let win = i == 11 && lt > 1.5;
        let (mut mx, mut my, mut nx, mut ny) = (1e9f32, 1e9f32, -1e9f32, -1e9f32);
        for p in h.iter() { mx = mx.min(p[0]); nx = nx.max(p[0]); my = my.min(p[1]); ny = ny.max(p[1]); }
        let s = (200.0 / (nx - mx)).min(190.0 / (ny - my)) * p;
        let d: String = h.iter().enumerate().map(|(k, q)| format!("{}{:.1} {:.1} ", if k == 0 { "M" } else { "L" }, x + 130.0 + q[0] * s, y + 110.0 - q[1] * s)).collect::<String>() + "Z";
        w!(o, r#"<g opacity="{:.2}">{}<path d="{d}" fill="{}" stroke="{}" stroke-width="2.5" />{}{}</g>"#, seg(lt, at, at + 0.15), card(x, y, 260.0, 300.0, if win { PHOSPHOR } else { HAIRLINE }, 1.0),
            if win { "#1F4A38" } else { RAISED }, if win { PHOSPHOR } else { LILAC }, mono(x + 24.0, y + 262.0, 20.0, MUTED, "start", 2.0, &format!("TILE {:02}", i + 1)),
            mono(x + 236.0, y + 286.0, 30.0, if win { PHOSPHOR } else { INK }, "end", 0.0, &format!("{}/h", group_sp(STACK_RATE_PER_H[i].round() as i64))));
    }
    o
}

// ---------------------------------------------------------------- final chorus: the app

fn live(lt: f32) -> String {
    let t = lt + T_FINAL;
    let mut o = String::new();
    let (px, pw, ph) = (690.0f32, 560.0f32, 900.0f32);
    let rise = pop_in(seg(lt, 0.0, 1.1));
    let py = 100.0 + (1.0 - rise) * 1000.0;
    let sc = (pw - 28.0) / 582.0;
    // phone
    w!(o, r#"<g transform="translate(0 {:.1}) rotate({:.2} {} {})">"#, py - 100.0, -3.0 * (1.0 - ss(seg(lt, 1.0, 2.5))), px + pw / 2.0, 550.0);
    w!(o, r#"<rect x="{}" y="{}" width="{}" height="{}" rx="56" fill="{VIOLET}" opacity="0.25" filter="url(#blur)" /><rect x="{px}" y="100" width="{pw}" height="{ph}" rx="52" fill="&#35;0B0810" stroke="{LILAC}" stroke-width="3" />"#, px - 10.0, 90.0, pw + 20.0, ph + 20.0);
    w!(o, r#"<clipPath id="scr"><rect x="{}" y="{}" width="{}" height="{}" rx="40" /></clipPath><g clip-path="url(#scr)"><rect x="{}" y="{}" width="{}" height="{}" fill="{GROUND}" />"#, px + 14.0, 114.0, pw - 28.0, ph - 28.0, px + 14.0, 114.0, pw - 28.0, ph - 28.0);
    let scroll = -ss(seg(lt, 4.5, 11.0)) * 360.0 * sc;
    w!(o, r#"<g transform="translate({} {:.1}) scale({sc:.4})">{}</g>"#, px + 14.0, 114.0 + scroll, app::now_screen(lt, t));
    w!(o, "{}", app::tab_bar(px + 14.0, 114.0 + ph - 28.0 - 96.0, pw - 28.0));
    w!(o, r#"</g><rect x="{}" y="116" width="120" height="26" rx="13" fill="&#35;0B0810" /></g>"#, px + pw / 2.0 - 60.0);
    // left: the headline
    let hp = pop_in(seg(lt, 0.4, 1.0));
    w!(o, r#"<g transform="translate(96 420) scale({hp:.3}) translate(-96 -420)">{}{}</g>"#, pop(96.0, 420.0, 230.0, "start", t, "LIVE"), pop(96.0, 510.0, 70.0, "start", t, "ON YOUR PHONE"));
    w!(o, "{}{}", chip(100.0, 560.0, "DEMO DATA", PINK, seg(lt, 1.0, 1.4)), mono(100.0, 640.0, 20.0, MUTED, "start", 2.0, "SIMULATED RATE, REAL SCREEN"));
    // right: the simulations that got us here
    const RECAP: [(&str, &str); 5] = [("GEANT4", "36.6 p.e. per muon"), ("NGSPICE", "5.8 mV per p.e."), ("HEAT", "+8.8 K at the BME280"), ("WI-FI", "9.3 mV worst input"), ("STACK", "4 371 triples / h")];
    for (k, (l, v)) in RECAP.iter().enumerate() {
        let at = 1.4 + k as f32 * BAR; let p = pop_in(seg(lt, at, at + 0.5)); if p <= 0.0 { continue; }
        let y = 150.0 + k as f32 * 150.0;
        w!(o, r#"<g transform="translate({:.1} 0)" opacity="{:.2}">{}{}{}<circle cx="1760" cy="{:.0}" r="20" fill="{PHOSPHOR}" /><path d="M1750 {:.0} L1758 {:.0} L1771 {:.0}" fill="none" stroke="{BUTTON_INK}" stroke-width="4" /></g>"#,
            (1.0 - p) * 140.0, seg(lt, at, at + 0.2), card(1316.0, y, 508.0, 126.0, HAIRLINE, 1.0), mono(1346.0, y + 44.0, 20.0, LILAC, "start", 4.0, l), txt(1346.0, y + 92.0, 34.0, 700, INK, "start", v), y + 63.0, y + 63.0, y + 71.0, y + 55.0);
    }
    o
}

// ---------------------------------------------------------------- outro

fn outro(lt: f32) -> String {
    let t = lt + T_OUTRO;
    let mut o = String::new();
    let p = pop_in(seg(lt, 0.6, 1.4)); let s = lerp(1.6, 1.0, p);
    w!(o, r#"<g transform="translate(960 520) scale({s:.3}) translate(-960 -520)" opacity="{:.2}">{}</g>"#, seg(lt, 0.6, 0.8), pop(960.0, 520.0, 300.0, "middle", t, "MUON3"));
    w!(o, r#"<g opacity="{:.2}">{}</g>"#, seg(lt, 1.4, 2.0), mono(960.0, 620.0, 30.0, MINT, "middle", 8.0, "gLOWCOST · GSU · sPHENIX TILES"));
    let names = ["GEANT4", "NGSPICE", "OPENEMS", "THERMAL", "FFRAMES", "ELEVENLABS MUSIC"];
    let total: f32 = names.iter().map(|n| 34.0 + n.len() as f32 * 13.2 + 24.0).sum::<f32>() - 24.0;
    let mut x = 960.0 - total / 2.0;
    for (i, n) in names.iter().enumerate() {
        let wd = 34.0 + n.len() as f32 * 13.2;
        w!(o, "{}", chip(x, 690.0, n, LILAC, seg(lt, 2.0 + i as f32 * 0.15, 2.4 + i as f32 * 0.15)));
        x += wd + 24.0;
    }
    w!(o, r#"<g opacity="{:.2}">{}</g>"#, seg(lt, 3.0, 3.6), mono(960.0, 800.0, 20.0, MUTED, "middle", 2.0, "EVERY NUMBER COMES FROM THE PROJECT'S OWN SIMULATIONS · APP SCREEN SHOWS DEMO DATA"));
    w!(o, "{}", muo(960.0, 910.0, 1.1, t, (0.0, 0.0)));
    o
}
