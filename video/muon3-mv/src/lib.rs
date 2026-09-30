//! Muon3 music video: a Nordic hyperpop story that follows one cosmic-ray muon through every simulation of the
//! project (Geant4 tile light, ngspice pulse chain, SiPM bias, board heat, Wi-Fi interference, tile stacking) and
//! ends on the gLowCost "Now" screen showing live data.
//!
//! The song is ElevenLabs Music (168 BPM, 96 s, `media/song.mp3`). Everything on screen is generated SVG text,
//! locked to the beat grid (`B` seconds per beat, bars of four) and to the song's energy sections (`T_*`).
//! Palette and type: gLowCost-iOs "violet & phosphor" (Raleway + IBM Plex Mono, chamfered cards).
use fframes::{AudioMap, AudioTimestamp::{Eof, Second}, AudioTrack, Color, Duration, FFramesContext, Frame, Svgr, Video};
use std::fmt::Write;

mod app;
pub mod data;
mod scenes;

pub const WIDTH: usize = 1920;
pub const HEIGHT: usize = 1080;
pub const TOTAL: f32 = 96.0;

// ---- timeline (seconds), snapped to bars of the 168 BPM grid: bar = 1.42857 s ----
pub const B: f32 = 60.0 / 168.0;
pub const BAR: f32 = 4.0 * B;
pub const T_VERSE1: f32 = 8.0 * BAR; // 11.43  Geant4
pub const T_PRE: f32 = 16.0 * BAR; // 22.86  the tile
pub const T_BREAK: f32 = 23.0 * BAR; // 32.86  1 p.e. = 5.8 mV
pub const T_CHORUS: f32 = 26.0 * BAR; // 37.14  ngspice
pub const T_QUIET: f32 = 38.0 * BAR; // 54.29  bias
pub const T_VERSE2: f32 = 40.0 * BAR; // 57.14  heat
pub const T_GAP: f32 = 45.0 * BAR; // 64.29  glitch
pub const T_EMI: f32 = 46.0 * BAR; // 65.71  Wi-Fi
pub const T_BRIDGE: f32 = 52.0 * BAR; // 74.29  12 tiles
pub const T_FINAL: f32 = 54.0 * BAR; // 77.14  the app
pub const T_OUTRO: f32 = 63.0 * BAR; // 90.0

// Palette: gLowCost-iOs/MuonMonitor/Shared/Palette.swift
pub const GROUND: &str = "#120E1A";
pub const PANEL: &str = "#1C1628";
pub const SHEEN: &str = "#231C33";
pub const RAISED: &str = "#261E35";
pub const HAIRLINE: &str = "#3A2F4F";
pub const BRIGHT_EDGE: &str = "#5E4A93";
pub const INK: &str = "#EEE9F5";
pub const MUTED: &str = "#A89CBF";
pub const VIOLET: &str = "#9B7BFF";
pub const LILAC: &str = "#C9B6FF";
pub const PHOSPHOR: &str = "#5BE3A0";
pub const MINT: &str = "#A6F5CF";
pub const PINK: &str = "#FF8FB1";
pub const BUTTON_TOP: &str = "#AE93FF";
pub const BUTTON_BOTTOM: &str = "#8462F0";
pub const BUTTON_INK: &str = "#16101F";
const SANS: &str = "Raleway";
const MONO: &str = "IBM Plex Mono";

#[macro_export]
macro_rules! w {
    ($o:expr, $($a:tt)*) => { let _ = write!($o, $($a)*); };
}

// ---- small math helpers ----
pub fn hash(n: u32) -> f32 {
    let mut x = n.wrapping_mul(0x9E37_79B1) ^ 0x85EB_CA6B;
    x ^= x >> 15; x = x.wrapping_mul(0x2C1B_3C6D); x ^= x >> 12; x = x.wrapping_mul(0x297A_2D39); x ^= x >> 15;
    (x & 0xFF_FFFF) as f32 / 16_777_216.0
}
pub fn clamp01(x: f32) -> f32 { x.clamp(0.0, 1.0) }
/// progress of t through [a, b], clamped to 0..1
pub fn seg(t: f32, a: f32, b: f32) -> f32 { clamp01((t - a) / (b - a)) }
pub fn eo(x: f32) -> f32 { 1.0 - (1.0 - clamp01(x)).powi(3) }
pub fn ss(x: f32) -> f32 { let x = clamp01(x); x * x * (3.0 - 2.0 * x) }
pub fn lerp(a: f32, b: f32, x: f32) -> f32 { a + (b - a) * x }
/// elastic overshoot: 0 → 1 with a bounce, for pop-in animations
pub fn pop_in(x: f32) -> f32 {
    let x = clamp01(x);
    if x >= 1.0 { return 1.0; }
    1.0 - (-7.0 * x).exp() * (x * 14.0).cos()
}
/// 1 at the beat, decaying
pub fn kick(t: f32) -> f32 { (-6.5 * (t / B).fract()).exp() }
/// 1 at the bar line, decaying
pub fn bar_kick(t: f32) -> f32 { (-4.0 * (t / BAR).fract()).exp() }

fn energy(t: f32) -> f32 {
    const K: [(f32, f32); 14] = [
        (0.0, 0.25), (5.0, 0.35), (8.0, 0.6), (T_VERSE1, 0.5), (T_PRE, 0.85), (T_BREAK, 0.3), (T_CHORUS, 1.0), (T_QUIET, 0.4),
        (T_VERSE2, 0.6), (T_BRIDGE, 0.6), (T_FINAL, 1.0), (T_OUTRO, 0.5), (TOTAL, 0.15), (TOTAL + 1.0, 0.1),
    ];
    for w in K.windows(2) {
        if t < w[1].0 { return lerp(w[0].1, w[1].1, ss((t - w[0].0) / (w[1].0 - w[0].0).max(0.001))); }
    }
    0.1
}

/// 13100 -> "13 100"
pub fn group_sp(n: i64) -> String {
    let s = n.to_string(); let mut o = String::new();
    for (i, c) in s.chars().enumerate() { if i > 0 && (s.len() - i) % 3 == 0 { o.push(' '); } o.push(c); }
    o
}

// ---- text helpers (x, y = baseline) ----
pub fn txt(x: f32, y: f32, size: f32, weight: u32, fill: &str, anchor: &str, s: &str) -> String {
    format!(r#"<text x="{x:.1}" y="{y:.1}" font-family="{SANS}" font-size="{size:.1}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{s}</text>"#)
}
pub fn mono(x: f32, y: f32, size: f32, fill: &str, anchor: &str, spacing: f32, s: &str) -> String {
    format!(r#"<text x="{x:.1}" y="{y:.1}" font-family="{MONO}" font-size="{size:.1}" letter-spacing="{spacing}" fill="{fill}" text-anchor="{anchor}">{s}</text>"#)
}
/// hyperpop title: slanted heavy text with a pink and a mint chromatic ghost that splits on the beat
pub fn pop(x: f32, y: f32, size: f32, anchor: &str, t: f32, s: &str) -> String {
    let d = size * (0.008 + 0.03 * kick(t));
    let skew = format!(r#"transform="translate({x:.1} {y:.1}) skewX(-8) translate({nx:.1} {ny:.1})""#, nx = -x, ny = -y);
    let t = |dx: f32, fill: &str, op: f32| {
        format!(r#"<text x="{:.1}" y="{y:.1}" font-family="{SANS}" font-size="{size:.1}" font-weight="800" letter-spacing="-3" fill="{fill}" opacity="{op}" text-anchor="{anchor}">{s}</text>"#, x + dx)
    };
    format!("<g {skew}>{}{}{}</g>", t(-d, PINK, 0.85), t(d, MINT, 0.85), t(0.0, INK, 1.0))
}
pub fn chamfer(x: f32, y: f32, w: f32, h: f32, c: f32) -> String {
    format!("M{x:.1} {y:.1} H{:.1} L{:.1} {:.1} V{:.1} H{:.1} L{x:.1} {:.1} Z", x + w - c, x + w, y + c, y + h, x + c, y + h - c)
}
pub fn chamfer4(x: f32, y: f32, w: f32, h: f32, c: f32) -> String {
    format!("M{:.1} {y:.1} H{:.1} L{:.1} {:.1} V{:.1} L{:.1} {:.1} H{:.1} L{x:.1} {:.1} V{:.1} Z", x + c, x + w - c, x + w, y + c, y + h - c, x + w - c, y + h, x + c, y + h - c, y + c)
}
/// the gLowCost card: sheen fill, hairline edge, cut top-right and bottom-left
pub fn card(x: f32, y: f32, w: f32, h: f32, edge: &str, op: f32) -> String {
    format!(r##"<path d="{}" fill="url(#sheen)" stroke="{edge}" stroke-width="2" opacity="{op:.3}" />"##, chamfer(x, y, w, h, 18.0))
}
pub fn chip(x: f32, y: f32, label: &str, col: &str, op: f32) -> String {
    let w = 34.0 + label.len() as f32 * 13.2;
    format!(r#"<g opacity="{op:.3}"><path d="{}" fill="{RAISED}" stroke="{col}" stroke-width="1.5" />{}</g>"#,
        chamfer4(x, y, w, 40.0, 6.0), mono(x + w / 2.0, y + 27.0, 20.0, col, "middle", 2.0, label))
}
/// four-point sparkle
pub fn sparkle(x: f32, y: f32, r: f32, fill: &str, op: f32) -> String {
    let k = r * 0.14;
    format!(r#"<path d="M{x:.1} {:.1} Q{:.1} {:.1} {:.1} {y:.1} Q{:.1} {:.1} {x:.1} {:.1} Q{:.1} {:.1} {:.1} {y:.1} Q{:.1} {:.1} {x:.1} {:.1} Z" fill="{fill}" opacity="{op:.3}" />"#,
        y - r, x + k, y - k, x + r, x + k, y + k, y + r, x - k, y + k, x - r, x - k, y - k, y - r)
}

// ---- the Nordic stage: sky, aurora, mountains, pines, snow, the sweater band ----
fn stage(t: f32) -> String {
    let e = energy(t);
    let mut o = String::new();
    w!(o, r##"<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="&#35;0A0712" /><stop offset="0.55" stop-color="&#35;1B1430" /><stop offset="1" stop-color="&#35;3A2A5C" /></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{SHEEN}" /><stop offset="1" stop-color="{PANEL}" /></linearGradient>
<linearGradient id="btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BUTTON_TOP}" /><stop offset="1" stop-color="{BUTTON_BOTTOM}" /></linearGradient>
<linearGradient id="au0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PHOSPHOR}" stop-opacity="0.0" /><stop offset="0.35" stop-color="{PHOSPHOR}" stop-opacity="0.9" /><stop offset="1" stop-color="{VIOLET}" stop-opacity="0.0" /></linearGradient>
<linearGradient id="au1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{VIOLET}" stop-opacity="0.0" /><stop offset="0.4" stop-color="{VIOLET}" stop-opacity="0.9" /><stop offset="1" stop-color="{PINK}" stop-opacity="0.0" /></linearGradient>
<linearGradient id="au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PINK}" stop-opacity="0.0" /><stop offset="0.4" stop-color="{PINK}" stop-opacity="0.8" /><stop offset="1" stop-color="{MINT}" stop-opacity="0.0" /></linearGradient>
<radialGradient id="orb" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="&#35;FFFFFF" /><stop offset="0.35" stop-color="{LILAC}" /><stop offset="1" stop-color="{VIOLET}" /></radialGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{PHOSPHOR}" stop-opacity="0.9" /><stop offset="1" stop-color="{PHOSPHOR}" stop-opacity="0" /></radialGradient>
<filter id="blur" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="16" /></filter>
<filter id="soft" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2320" height="1480"><feGaussianBlur stdDeviation="5" /></filter>
</defs>
<rect width="1920" height="1080" fill="url(#sky)" />"##);
    // stars
    for i in 0..80u32 {
        let (x, y) = (hash(i) * 1920.0, hash(i + 500) * 640.0);
        let tw = 0.25 + 0.75 * ((t * (0.6 + hash(i + 900)) + i as f32).sin()).abs();
        w!(o, r#"<circle cx="{x:.0}" cy="{y:.0}" r="{:.1}" fill="{INK}" opacity="{:.2}" />"#, 0.8 + 1.4 * hash(i + 77), tw * 0.8);
    }
    // aurora curtains, blurred once as a group
    w!(o, r#"<g filter="url(#blur)" opacity="{:.2}">"#, 0.30 + 0.55 * e);
    for k in 0..3u32 {
        let mut top = String::new(); let mut bot = String::new();
        let f = 0.0028 + 0.0011 * k as f32; let sp = 0.35 + 0.17 * k as f32; let base = 170.0 + 80.0 * k as f32;
        let amp = 50.0 + 70.0 * e;
        for i in 0..=34u32 {
            let x = i as f32 * 58.0 - 20.0;
            let yt = base + amp * (x * f + t * sp + k as f32 * 2.1).sin() + 36.0 * (x * f * 2.7 - t * sp * 1.3).sin();
            let hh = 190.0 + 130.0 * e + 70.0 * (x * f * 1.9 + t * 0.5 + k as f32).sin();
            w!(top, "{}{:.0} {:.0} ", if i == 0 { "M" } else { "L" }, x, yt);
            w!(bot, "L{:.0} {:.0} ", x, yt + hh);
        }
        // reverse the bottom edge
        let pts: Vec<&str> = bot.split('L').filter(|s| !s.is_empty()).collect();
        let back: String = pts.iter().rev().map(|p| format!("L{p}")).collect();
        w!(o, r#"<path d="{top}{back} Z" fill="url(#au{k})" />"#);
    }
    w!(o, "</g>");
    // hyperpop sparkles (pulse on the beat)
    for i in 0..9u32 {
        let (x, y) = (80.0 + hash(i + 31) * 1760.0, 70.0 + hash(i + 61) * 560.0);
        let r = (10.0 + 16.0 * hash(i + 11)) * (0.5 + 0.9 * kick(t + hash(i) * B) * e + 0.3 * e);
        let c = [LILAC, PINK, MINT][i as usize % 3];
        w!(o, "{}", sparkle(x, y, r, c, 0.55));
    }
    // mountains with parallax, then pines
    let layers = [("#2A2044", 740.0, 0.6, 18.0, 0.9), ("#1C1630", 830.0, 0.85, 26.0, 1.3), ("#140F20", 920.0, 1.0, 34.0, 1.8)];
    for (li, (col, base, rough, amp, speed)) in layers.iter().enumerate() {
        let mut d = String::from("M-10 1080 ");
        for i in 0..=50u32 {
            let x = i as f32 * 40.0 - 10.0; let u = x + t * speed * 2.0 + li as f32 * 300.0;
            let y = base - amp * 2.2 * ((u * 0.0042 * rough).sin() + 0.6 * (u * 0.011 * rough + 1.7).sin() + 0.3 * (u * 0.023 + li as f32).sin()).abs();
            w!(d, "L{x:.0} {y:.0} ");
        }
        w!(d, "L1930 1080 Z");
        w!(o, r#"<path d="{d}" fill="{col}" />"#);
    }
    for i in 0..26u32 {
        let x = i as f32 * 76.0 + hash(i + 3) * 40.0 - (t * 3.6) % 76.0; let h = 70.0 + 70.0 * hash(i + 8); let y = 985.0;
        w!(o, r#"<path d="M{:.0} {y:.0} L{x:.0} {:.0} L{:.0} {y:.0} Z" fill="&#35;0E0A16" />"#, x - h * 0.2, y - h, x + h * 0.2);

    }
    // snow
    for i in 0..70u32 {
        let x = (hash(i) * 1960.0 + 34.0 * (t * 0.6 + i as f32).sin()) % 1920.0;
        let y = (hash(i + 99) * 1100.0 + t * (36.0 + 70.0 * hash(i + 7))) % 1100.0 - 10.0;
        w!(o, r#"<circle cx="{x:.0}" cy="{y:.0}" r="{:.1}" fill="&#35;FFFFFF" opacity="{:.2}" />"#, 1.2 + 2.6 * hash(i + 17), 0.25 + 0.5 * hash(i + 4));
    }
    // the Fair Isle band along the bottom: diamonds and crosses, scrolling, pulsing on the beat
    w!(o, r#"<rect x="0" y="1018" width="1920" height="62" fill="{GROUND}" /><rect x="0" y="1018" width="1920" height="2" fill="{BRIGHT_EDGE}" />"#);
    let off = (t * 14.0) % 96.0;
    for i in -1..22i32 {
        let cx = i as f32 * 96.0 + 48.0 - off; let s = 1.0 + 0.18 * kick(t);
        let d = 17.0 * s;
        w!(o, r#"<path d="M{:.0} 1049 L{cx:.0} {:.0} L{:.0} 1049 L{cx:.0} {:.0} Z" fill="{}" opacity="0.9" />"#, cx - d, 1049.0 - d, cx + d, 1049.0 + d, if i % 2 == 0 { VIOLET } else { LILAC });
        w!(o, r#"<path d="M{:.0} 1049 L{cx:.0} {:.0} L{:.0} 1049 L{cx:.0} {:.0} Z" fill="{GROUND}" />"#, cx - d * 0.45, 1049.0 - d * 0.45, cx + d * 0.45, 1049.0 + d * 0.45);
        w!(o, r#"<rect x="{:.0}" y="1045" width="8" height="8" fill="{}" />"#, cx + 40.0 - 4.0, if i % 2 == 0 { PHOSPHOR } else { PINK });
    }
    o
}

/// glitch cut on every section boundary: a few torn colour bars for a fifth of a second
fn glitch_cuts(t: f32) -> String {
    let mut o = String::new();
    for (n, b) in [T_VERSE1, T_PRE, T_BREAK, T_CHORUS, T_QUIET, T_VERSE2, T_GAP, T_EMI, T_BRIDGE, T_FINAL, T_OUTRO].iter().enumerate() {
        let d = t - b;
        if !(-0.05..0.22).contains(&d) { continue; }
        let a = 1.0 - ((d - 0.0).abs() / 0.22).min(1.0);
        for k in 0..9u32 {
            let seed = n as u32 * 40 + k + ((t * 30.0) as u32 % 4) * 7;
            let (y, h) = (hash(seed) * 1000.0, 14.0 + hash(seed + 1) * 70.0);
            let (x, wd) = (hash(seed + 2) * 900.0 - 100.0, 500.0 + hash(seed + 3) * 1500.0);
            let c = [PINK, MINT, LILAC, INK][(seed % 4) as usize];
            w!(o, r#"<rect x="{x:.0}" y="{y:.0}" width="{wd:.0}" height="{h:.0}" fill="{c}" opacity="{:.2}" />"#, 0.5 * a);
        }
        w!(o, r#"<rect width="1920" height="1080" fill="&#35;FFFFFF" opacity="{:.2}" />"#, 0.35 * a * a);
    }
    o
}

pub struct MusicVideo;
impl MusicVideo { pub fn new() -> Self { Self } }
impl std::fmt::Debug for MusicVideo { fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.debug_struct("MusicVideo").finish() } }

impl Video for MusicVideo {
    const FPS: usize = 30;
    const WIDTH: usize = WIDTH;
    const HEIGHT: usize = HEIGHT;
    const BACKGROUND_COLOR: Color = Color::BLACK;

    fn duration(&self) -> Duration<'_> { Duration::Seconds(TOTAL) }

    fn audio(&self) -> AudioMap<'_> { AudioMap::from(vec![AudioTrack::new("song.mp3", Second(0.0)..Eof)]) }

    fn render_frame<'a>(&'a self, frame: Frame, _ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let t = frame.seconds();
        let mut o = String::with_capacity(200_000);
        w!(o, r#"<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 1920 1080">"#);
        o.push_str(&stage(t));
        // the whole scene breathes on the beat: a small zoom punch, bigger in the choruses
        let e = energy(t);
        let zoom = 1.0 + (0.004 + 0.010 * e) * kick(t) + 0.008 * e * bar_kick(t);
        w!(o, r#"<g transform="translate(960 540) scale({zoom:.4}) translate(-960 -540)">"#);
        o.push_str(&scenes::scene(t));
        o.push_str("</g>");
        o.push_str(&glitch_cuts(t));
        // fade in from the dark and out to it
        let fade = (1.0 - seg(t, 0.0, 0.8)).max(seg(t, TOTAL - 1.6, TOTAL));
        w!(o, r#"<rect width="1920" height="1080" fill="{GROUND}" opacity="{fade:.3}" />"#);
        o.push_str("</svg>");
        Svgr::from(o)
    }
}
