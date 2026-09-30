//! Muon3 assembly guide: a seven-scene instructional video in the gLowCost design language
//! ("violet & phosphor": dark violet ground, chamfered cards instead of rounded corners, phosphor-green for
//! live data and progress, lilac for muon tracks, pink only for alerts; Raleway for text, IBM Plex Mono for
//! numbers and caps labels).
//!
//! The voice-over is ElevenLabs v4 (voice "Lynda"), one mp3 per scene; every scene is exactly its narration plus a
//! short lead-in and tail, so the animation cues below are fractions of the narration length.
use fframes::{
    AnimateRuntimeInput, AudioMap, AudioTimestamp::Second, AudioTimestamp::Eof, AudioTrack, Color, Duration, FFramesContext,
    FFramesSyncedVideoFrame, FontQuery, Frame, Scene, Scenes, SyncVideoFrameInput, Svgr, TextOverflow, Transform, Video,
    animation::{AnimationRuntime, Easing},
};
use std::sync::LazyLock;

pub const WIDTH: usize = 1920;
pub const HEIGHT: usize = 1080;

/// Narration lengths (s) of media/vo0..vo6.mp3.
const VO: [f32; 7] = [17.6, 14.4, 14.64, 10.24, 14.16, 16.0, 19.52];
const LEAD: f32 = 0.6;
const TAIL: f32 = 0.5;
const NAMES: [&str; 6] = ["01 TILES", "02 FRAME", "03 PLATE", "04 CASE", "05 CABLES", "06 TEST"];

fn scene_secs(i: usize) -> f32 { VO[i] + LEAD + TAIL }
fn scene_start(i: usize) -> f32 { (0..i).map(scene_secs).sum() }
fn total_secs() -> f32 { scene_start(7) }

// Palette: gLowCost-iOs/MuonMonitor/Shared/Palette.swift
const GROUND: &str = "#120E1A";
const PANEL: &str = "#1C1628";
const SHEEN: &str = "#231C33";
const RAISED: &str = "#261E35";
const HAIRLINE: &str = "#3A2F4F";
const BRIGHT_EDGE: &str = "#5E4A93";
const INK: &str = "#EEE9F5";
const MUTED: &str = "#A89CBF";
const VIOLET: &str = "#9B7BFF";
const LILAC: &str = "#C9B6FF";
const PHOSPHOR: &str = "#5BE3A0";
const PINK: &str = "#FF8FB1";
const BUTTON_TOP: &str = "#AE93FF";
const BUTTON_BOTTOM: &str = "#8462F0";
const BUTTON_INK: &str = "#16101F";

const SANS: &str = "Raleway";
const MONO: &str = "IBM Plex Mono";

static EASE: LazyLock<AnimationRuntime> =
    LazyLock::new(|| AnimationRuntime::new(0.7, &Easing::CubicBezier(0.16, 1.0, 0.3, 1.0)));
static SPRING: LazyLock<AnimationRuntime> = LazyLock::new(|| {
    AnimationRuntime::new(3.0, &Easing::Spring { mass: 1.0, stiffness: 190.0, damping: 21.0 })
});
static COUNT: LazyLock<AnimationRuntime> =
    LazyLock::new(|| AnimationRuntime::new(1.6, &Easing::CubicBezier(0.3, 0.0, 0.2, 1.0)));

fn ramp(frame: &Frame, start: f32) -> f32 {
    frame.animate_runtime(AnimateRuntimeInput { on_second: start, from: 0.0, to: 1.0, animation_runtime: &EASE })
}
fn rise(frame: &Frame, start: f32) -> f32 {
    frame.animate_runtime(AnimateRuntimeInput { on_second: start, from: 48.0, to: 0.0, animation_runtime: &SPRING })
}
fn count_to(frame: &Frame, start: f32, to: f32) -> f32 {
    frame.animate_runtime(AnimateRuntimeInput { on_second: start, from: 0.0, to, animation_runtime: &COUNT })
}

/// Rectangle with the gLowCost chamfer: cut top-right and bottom-left (cards, panels).
fn chamfer(x: f32, y: f32, w: f32, h: f32, c: f32) -> String {
    format!(
        "M{x} {y} H{} L{} {} V{} H{} L{x} {} Z",
        x + w - c, x + w, y + c, y + h, x + c, y + h - c
    )
}
/// Rectangle with all four corners cut (buttons, chips, tab bar).
fn chamfer4(x: f32, y: f32, w: f32, h: f32, c: f32) -> String {
    format!(
        "M{} {y} H{} L{} {} V{} L{} {} H{} L{x} {} V{} Z",
        x + c, x + w - c, x + w, y + c, y + h - c, x + w - c, y + h, x + c, y + h - c, y + c
    )
}

pub struct GuideVideo {
    scenes: Vec<StepScene>,
}

impl GuideVideo {
    pub fn new() -> Self {
        Self { scenes: (0..7).map(StepScene::new).collect() }
    }
}

impl std::fmt::Debug for GuideVideo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.debug_struct("GuideVideo").finish() }
}

impl Video for GuideVideo {
    const FPS: usize = 30;
    const WIDTH: usize = WIDTH;
    const HEIGHT: usize = HEIGHT;
    const BACKGROUND_COLOR: Color = Color::BLACK;

    fn duration(&self) -> Duration<'_> { Duration::Auto }

    fn audio(&self) -> AudioMap<'_> {
        let mut tracks = Vec::new();
        for i in 0..7 {
            let file: &'static str = ["vo0.mp3", "vo1.mp3", "vo2.mp3", "vo3.mp3", "vo4.mp3", "vo5.mp3", "vo6.mp3"][i];
            tracks.push(AudioTrack::new(file, Second(scene_start(i) + LEAD)..Eof).voice());
            tracks.push(AudioTrack::new("pop.wav", Second(scene_start(i) + 0.1)..Eof).gain_db(-12.));
        }
        AudioMap::from(tracks)
    }

    fn define_scenes(&self) -> Scenes<'_> {
        Scenes::from(self.scenes.iter().map(|s| s as &dyn Scene).collect::<Vec<_>>())
    }

    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let t = frame.seconds();
        // the muon tracks of the Now screen: thin lilac lines drifting across the ground
        let tracks: Vec<Svgr> = (0..18u32)
            .map(|i| {
                let x0 = ((i * 137 + 61) % 2100) as f32 - 100.0 + t * (5.0 + (i % 5) as f32 * 2.5);
                let slope = (((i * 53 + 17) % 47) as f32 - 23.0) / 90.0;
                let op = 0.07 + (i % 4) as f32 * 0.045;
                let w = 1.5 + (i % 3) as f32 * 0.8;
                let x1 = x0 + slope * 1200.0;
                fframes::svgr!(<line x1={x0} y1="-40" x2={x1} y2="1160" stroke={LILAC} stroke-opacity={op} stroke-width={w} />)
            })
            .collect();
        let step = self.current_step(t);
        let overall = (t / total_secs()).min(1.0);
        fframes::svgr!(
            <svg xmlns="http://www.w3.org/2000/svg" width={WIDTH} height={HEIGHT} viewBox="0 0 1920 1080">
                <rect width="1920" height="1080" fill={GROUND} />
                {tracks}
                {ctx.render_scenes(&frame)}
                {progress_rail(step, overall, &frame)}
            </svg>
        )
    }
}

impl GuideVideo {
    /// 0 = not a numbered step (welcome), 1..=6 = step.
    fn current_step(&self, t: f32) -> usize {
        (0..7).rev().find(|&i| t >= scene_start(i)).unwrap_or(0)
    }
}

/// Six chamfered segments at the bottom, one per step: done = bright edge, current = phosphor filling with the scene.
fn progress_rail<'a>(step: usize, overall: f32, frame: &Frame) -> Svgr<'a> {
    let seg_w = 272.0f32;
    let gap = 19.2f32;
    let local = if step >= 1 {
        ((frame.seconds() - scene_start(step)) / scene_secs(step)).clamp(0.0, 1.0)
    } else { 0.0 };
    let segs: Vec<Svgr> = (0..6usize)
        .map(|k| {
            let x = 96.0 + k as f32 * (seg_w + gap);
            let (fill, frac) = if step == 0 { (RAISED, 0.0) } else if k + 1 < step { (BRIGHT_EDGE, 1.0) } else if k + 1 == step { (RAISED, local) } else { (RAISED, 0.0) };
            let label_col = if k + 1 == step { PHOSPHOR } else if k + 1 < step { LILAC } else { MUTED };
            fframes::svgr!(<g>
                <path d={chamfer4(x, 1000.0, seg_w, 14.0, 5.0)} fill={fill} stroke={HAIRLINE} stroke-width="1" />
                <rect x={x} y="1000" width={(seg_w * frac).max(0.5)} height="14" fill={PHOSPHOR} opacity={if frac > 0.0 && k + 1 == step { 1.0 } else { 0.0 }} />
                <text x={x} y="1046" font-family={MONO} font-size="20" letter-spacing="3" fill={label_col}>{NAMES[k]}</text>
            </g>)
        })
        .collect();
    fframes::svgr!(<g>
        {segs}
        <rect x="96" y="1060" width="1728" height="2" fill={HAIRLINE} />
        <rect x="96" y="1060" width={(1728.0 * overall).max(0.5)} height="2" fill={VIOLET} />
    </g>)
}

// ------------------------------------------------------------------ scene data

struct Row {
    text: &'static str,
    at: f32, // fraction of the narration when the row appears
}

struct Counter {
    label: &'static str,
    target: f32,
    at: f32,
}

struct StepData {
    kicker: &'static str,
    title: &'static str,
    image: &'static str,
    /// card size; landscape images sit on top, portrait images on the left
    wide: bool,
    rows: Vec<Row>,
    counters: Vec<Counter>,
    chips: Vec<&'static str>,
    alert: Option<&'static str>,
}

fn data(i: usize) -> StepData {
    match i {
        0 => StepData {
            kicker: "MUON3 · ASSEMBLY GUIDE", title: "Let's build a detector", image: "board.jpg", wide: false,
            rows: vec![
                Row { text: "Matching tiles, with fiber and SiPM board", at: 0.25 },
                Row { text: "Printed frame, plate bars and case", at: 0.40 },
                Row { text: "Board from JLC, USB-C powered", at: 0.55 },
                Row { text: "M3 socket-head screws + heat-set inserts", at: 0.70 },
                Row { text: "One short coax cable per tile", at: 0.88 },
            ],
            counters: vec![], chips: vec!["6 STEPS", "ABOUT 2 HOURS", "NO GLUE"], alert: None,
        },
        1 => StepData {
            kicker: "STEP 1 OF 6", title: "The tiles", image: "panels.jpg", wide: false,
            rows: vec![
                Row { text: "Fiber into its groove: one closed loop", at: 0.14 },
                Row { text: "Polish both ends flush with the edge", at: 0.42 },
                Row { text: "Reflector, foil, cling film, vinyl", at: 0.62 },
                Row { text: "Coupler glued over both fiber ends", at: 0.80 },
            ],
            counters: vec![], chips: vec!["1 LOOP", "0.75 MM AIR GAP", "1 SIPM"], alert: None,
        },
        2 => StepData {
            kicker: "STEP 2 OF 6", title: "The frame", image: "step2.jpg", wide: false,
            rows: vec![
                Row { text: "Four rods through the corner clips", at: 0.12 },
                Row { text: "Stack: spacer, tile, spacer", at: 0.42 },
                Row { text: "The clips hold the corners. Never drill a tile", at: 0.66 },
            ],
            counters: vec![Counter { label: "CORNER CLIPS", target: 16.0, at: 0.14 }, Counter { label: "SPACERS", target: 18.0, at: 0.44 }],
            chips: vec!["M6 RODS", "8 MM SLOT"], alert: None,
        },
        3 => StepData {
            kicker: "STEP 3 OF 6", title: "The back plate", image: "step3.jpg", wide: false,
            rows: vec![
                Row { text: "Three bars onto the back rods", at: 0.15 },
                Row { text: "In the gaps between the tiles", at: 0.45 },
                Row { text: "Every cable passes between them", at: 0.75 },
            ],
            counters: vec![Counter { label: "PLATE BARS", target: 3.0, at: 0.15 }], chips: vec!["Z = 50 · 150 · 250 MM"], alert: None,
        },
        4 => StepData {
            kicker: "STEP 4 OF 6", title: "The electronics", image: "step4.jpg", wide: false,
            rows: vec![
                Row { text: "Heat-set inserts into the case bases", at: 0.12 },
                Row { text: "Lower the board in", at: 0.34 },
                Row { text: "Close the lids: M3 × 12", at: 0.52 },
                Row { text: "Fasten the segments to the bars: M3 × 6", at: 0.78 },
            ],
            counters: vec![Counter { label: "LID SCREWS", target: 13.0, at: 0.56 }, Counter { label: "MOUNT SCREWS", target: 10.0, at: 0.80 }],
            chips: vec!["3 CASE SEGMENTS"], alert: None,
        },
        5 => StepData {
            kicker: "STEP 5 OF 6", title: "Cables and antenna", image: "step5.jpg", wide: false,
            rows: vec![
                Row { text: "Coax onto each tile's SiPM board", at: 0.10 },
                Row { text: "Through the notch in the lid", at: 0.36 },
                Row { text: "Click onto the matching jack", at: 0.54 },
                Row { text: "Antenna on the lid, pigtail to the ESP32", at: 0.80 },
            ],
            counters: vec![], chips: vec!["ALL CABLES EQUAL", "U.FL"], alert: None,
        },
        _ => StepData {
            kicker: "STEP 6 OF 6", title: "The test", image: "scope.jpg", wide: false,
            rows: vec![
                Row { text: "Plug in USB-C", at: 0.10 },
                Row { text: "Board test: about two minutes", at: 0.28 },
                Row { text: "Calibrate each tile", at: 0.44 },
            ],
            counters: vec![], chips: vec!["STATION_TEST.PY"],
            alert: Some("Never clip a scope ground to a U.FL shell: it carries the bias"),
        },
    }
}

#[derive(Debug)]
struct StepScene {
    idx: usize,
}
impl StepScene {
    fn new(idx: usize) -> Self { Self { idx } }
}

fn fit_size<'a>(frame: &mut Frame, ctx: &FFramesContext<'a, '_>, text: &'a str, preferred: usize, max_width: usize, weight: u16) -> usize {
    let mut size = preferred;
    loop {
        let font = FontQuery { family: SANS, size, weight, ..Default::default() };
        match frame.text_width(ctx, font, text) {
            Some(width) if width > max_width && size > 32 => size -= 4,
            _ => return size,
        }
    }
}

impl Scene for StepScene {
    fn duration(&self) -> Duration<'_> { Duration::Seconds(scene_secs(self.idx)) }

    fn render_frame<'a>(&'a self, mut frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let i = self.idx;
        let d = data(i);
        let t = frame.seconds();
        let vo = VO[i];
        let fade_out = ((scene_secs(i) - t) / 0.35).clamp(0.0, 1.0);
        let fade_in = ramp(&frame, 0.0);
        let master = fade_in.min(fade_out);

        // layout
        let (cx, cy, cw, ch) = if d.wide { (96.0f32, 170.0f32, 1728.0f32, if i == 0 { 232.0 } else { 440.0 }) } else { (96.0, 150.0, 660.0, 780.0) };
        let rx = if d.wide { 96.0 } else { cx + cw + 72.0 };
        let ry = if d.wide { cy + ch + 40.0 } else { 150.0 };
        let rw = if d.wide { 1728.0f32 } else { 1824.0 - rx };

        let pad = 18.0f32;
        let img_x = cx + pad; let img_y = cy + pad; let img_w = cw - 2.0 * pad; let img_h = ch - 2.0 * pad;
        let clip_id = format!("clip{i}");

        // the detector model, rendered with three.js (video/detector3d) for exactly this scene; `pic` is empty if the clip is missing
        let vid = frame.get_synced_video_frame(ctx, format!("scene{i}.mp4"), &SyncVideoFrameInput { start_from: 0.0, looping: false, editor_fallback_image: None });
        let pic: Vec<Svgr> = vid.into_iter().map(|v| {
            let href = v.into_image().href();
            fframes::svgr!(<g clip-path={format!("url(#{clip_id})")}>
                <image href={href} x={img_x} y={img_y} width={img_w} height={img_h} preserveAspectRatio="xMidYMid slice" />
            </g>)
        }).collect();

        let title_size = fit_size(&mut frame, ctx, d.title, 104, (rw as usize).min(900), 800);
        let title_y = ry + if d.wide { 70.0 } else { 120.0 };

        // checklist rows (chamfered raised tiles); the check mark lands when the narration reaches the line
        let cols = if d.wide { 2usize } else { 1 };
        let row_w = if d.wide { (rw - 24.0) / 2.0 } else { rw };
        let row_h = 88.0f32;
        let list_y = title_y + if d.wide { 34.0 } else { 70.0 };
        let rows: Vec<Svgr> = d.rows.iter().enumerate().map(|(k, r)| {
            let at = LEAD + r.at * vo;
            let col = k % cols; let line = k / cols;
            let x = rx + col as f32 * (row_w + 24.0);
            let y = list_y + line as f32 * (row_h + 16.0);
            let p = ramp(&frame, at - 0.3);
            let tick = ramp(&frame, at);
            let text = frame.text_fit(ctx, FontQuery { family: SANS, size: 32, weight: 600, ..Default::default() }, r.text, (row_w - 120.0) as usize, TextOverflow::Ellipsis)
                .map(|s| s.into_owned()).unwrap_or_else(|| r.text.to_owned());
            fframes::svgr!(<g opacity={p} transform={Transform::translate(0, rise(&frame, at - 0.3))}>
                <path d={chamfer(x, y, row_w, row_h, 14.0)} fill={RAISED} stroke={if tick > 0.5 { PHOSPHOR } else { HAIRLINE }} stroke-width="2" stroke-opacity={if tick > 0.5 { 0.55 } else { 1.0 }} />
                <circle cx={x + 48.0} cy={y + row_h / 2.0} r="22" fill="none" stroke={if tick > 0.05 { PHOSPHOR } else { HAIRLINE }} stroke-width="3" />
                <path d={format!("M{} {} l8 9 l16 -19", x + 37.0, y + row_h / 2.0)} stroke={PHOSPHOR} stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity={tick} />
                <text x={x + 92.0} y={y + row_h / 2.0 + 11.0} font-family={SANS} font-size="32" font-weight="600" fill={INK}>{text}</text>
            </g>)
        }).collect();
        let rows_h = ((d.rows.len() + cols - 1) / cols) as f32 * (row_h + 16.0);

        // counters: Plex Mono numerals counting up, like the minute counters of the app
        let cy0 = list_y + rows_h + 18.0;
        let counters: Vec<Svgr> = d.counters.iter().enumerate().map(|(k, c)| {
            let at = LEAD + c.at * vo;
            let x = rx + k as f32 * 300.0;
            let p = ramp(&frame, at - 0.2);
            let v = count_to(&frame, at, c.target);
            fframes::svgr!(<g opacity={p}>
                <path d={chamfer(x, cy0, 280.0, 132.0, 14.0)} fill={PANEL} stroke={BRIGHT_EDGE} stroke-width="2" />
                <text x={x + 24.0} y={cy0 + 38.0} font-family={MONO} font-size="20" letter-spacing="3" fill={MUTED}>{c.label}</text>
                <text x={x + 24.0} y={cy0 + 108.0} font-family={MONO} font-size="76" font-weight="500" fill={PHOSPHOR}>{format!("{:.0}", v)}</text>
            </g>)
        }).collect();
        let chips_y = cy0 + if d.counters.is_empty() { 4.0 } else { 160.0 };
        let mut chip_x = rx;
        let chips: Vec<Svgr> = d.chips.iter().enumerate().map(|(k, s)| {
            let w = 34.0 + s.len() as f32 * 15.5;
            let x = chip_x; chip_x += w + 14.0;
            let p = ramp(&frame, LEAD + 0.3 + k as f32 * 0.12);
            fframes::svgr!(<g opacity={p}>
                <path d={chamfer4(x, chips_y, w, 46.0, 8.0)} fill={PANEL} stroke={LILAC} stroke-opacity="0.6" stroke-width="1.5" />
                <text x={x + w / 2.0} y={chips_y + 31.0} text-anchor="middle" font-family={MONO} font-size="20" letter-spacing="2" fill={LILAC}>{*s}</text>
            </g>)
        }).collect();

        // pink is reserved for alerts: the one warning of the whole guide
        let alert = d.alert.map(|a| {
            let at = LEAD + 0.62 * vo;
            let p = ramp(&frame, at);
            let y = chips_y + 70.0;
            let pulse = 0.55 + 0.25 * (t * 4.0).sin();
            fframes::svgr!(<g opacity={p} transform={Transform::translate(0, rise(&frame, at))}>
                <path d={chamfer(rx, y, rw, 118.0, 14.0)} fill="#2B1826" stroke={PINK} stroke-width="2" stroke-opacity={pulse} />
                <path d={format!("M{} {} l22 -40 l22 40 Z", rx + 32.0, y + 78.0)} fill="none" stroke={PINK} stroke-width="4" stroke-linejoin="round" />
                <text x={rx + 66.0} y={y + 72.0} text-anchor="middle" font-family={MONO} font-size="26" fill={PINK}>"!"</text>
                <text x={rx + 112.0} y={y + 50.0} font-family={MONO} font-size="20" letter-spacing="3" fill={PINK}>"WARNING"</text>
                <text x={rx + 112.0} y={y + 92.0} font-family={SANS} font-size="32" font-weight="600" fill={INK}>{a}</text>
            </g>)
        });

        // final hero message on the last scene
        let done = if i == 6 {
            let at = LEAD + 0.90 * vo;
            let p = ramp(&frame, at);
            let y = 880.0;
            Some(fframes::svgr!(<g opacity={p} transform={Transform::translate(0, rise(&frame, at))}>
                <path d={chamfer4(rx, y, 360.0, 76.0, 10.0)} fill={format!("url(#btn{i})")} stroke={LILAC} stroke-width="2" />
                <text x={rx + 180.0} y={y + 50.0} text-anchor="middle" font-family={SANS} font-size="36" font-weight="800" fill={BUTTON_INK}>"You're done"</text>
            </g>))
        } else { None };

        // the picture card: chamfered, bright edge like the hero card of the Now screen
        let kicker_op = ramp(&frame, 0.1);
        let glyph_x = 96.0f32; let glyph_y = 70.0f32;
        fframes::svgr!(<g opacity={master} font-family={SANS}>
            <defs>
                <clipPath id={clip_id.clone()}><path d={chamfer(img_x, img_y, img_w, img_h, 14.0)} /></clipPath>
                <linearGradient id={format!("btn{i}")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={BUTTON_TOP} /><stop offset="1" stop-color={BUTTON_BOTTOM} /></linearGradient>
                <linearGradient id={format!("sheen{i}")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={SHEEN} /><stop offset="1" stop-color={PANEL} /></linearGradient>
            </defs>
            // header: the muon glyph (two tracks crossing a paddle) and the caps label
            <g transform={Transform::translate(glyph_x, glyph_y)} opacity={kicker_op}>
                <path d="M4 2 L40 50 M44 0 L12 50" stroke={LILAC} stroke-width="3" stroke-linecap="round" />
                <rect x="4" y="19" width="40" height="14" fill={GROUND} stroke={LILAC} stroke-width="3" />
                <text x="68" y="36" font-family={MONO} font-size="24" letter-spacing="4" fill={MUTED}>{d.kicker}</text>
            </g>
            // card
            <path d={chamfer(cx, cy, cw, ch, 18.0)} fill={format!("url(#sheen{i})")} stroke={BRIGHT_EDGE} stroke-width="3" />
            {pic}
            // title and content
            <text x={rx} y={title_y} font-size={title_size} font-weight="800" letter-spacing="-2" fill={INK} opacity={ramp(&frame, 0.15)}>{d.title}</text>
            <rect x={rx} y={title_y + 18.0} width={(160.0 * ramp(&frame, 0.3)).max(0.5)} height="5" fill={PHOSPHOR} />
            {rows}
            {counters}
            {chips}
            {alert.into_iter().collect::<Vec<_>>()}
            {done.into_iter().collect::<Vec<_>>()}
        </g>)
    }
}
