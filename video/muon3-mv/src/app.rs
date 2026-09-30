//! The gLowCost-iOs "Now" screen, redrawn in SVG (layout from design/renders/Main.png, 582 logical px wide) with
//! demo numbers that tick on the beat. Every card uses the app's chamfer: cut top-right and bottom-left.
use crate::*;

fn ch_label(x: f32, y: f32, top: &str, bot: &str, col: &str) -> String {
    format!(r#"{}{}{}"#, mono(x, y, 19.0, col, "start", 1.0, "CH"), mono(x + 26.0, y - 8.0, 11.0, col, "start", 0.0, top), mono(x + 26.0, y + 5.0, 11.0, col, "start", 0.0, bot))
}

fn spark(x: f32, y: f32, seed: u32, lt: f32) -> String {
    let mut d = String::new();
    for i in 0..9u32 {
        let v = 14.0 * (hash(seed + i) - 0.5) + 4.0 * (lt * 2.0 + i as f32 + seed as f32).sin();
        w!(d, "{}{:.1} {:.1} ", if i == 0 { "M" } else { "L" }, x + i as f32 * 13.0, y - v);
    }
    format!(r#"<path d="{d}" fill="none" stroke="{PHOSPHOR}" stroke-width="2.5" stroke-linejoin="round" />"#)
}

pub fn now_screen(lt: f32, t: f32) -> String {
    let mut o = String::new();
    let bar = (lt / BAR).floor() as u32;
    let count = |target: f32, at: f32| -> f32 { target * eo(seg(lt, at, at + 1.1)) };
    // header
    w!(o, "{}{}", mono(30.0, 100.0, 17.0, MUTED, "start", 2.0, "MUONP4 · MAGNOLIA"), txt(30.0, 152.0, 54.0, 800, INK, "start", "Now"));
    w!(o, r#"<path d="{}" fill="{RAISED}" stroke="{HAIRLINE}" stroke-width="1.5" />"#, chamfer4(487.0, 94.0, 65.0, 65.0, 12.0));
    for (r, op) in [(22.0f32, 0.45), (14.0, 0.7), (6.0, 1.0)] {
        w!(o, r#"<path d="M{:.1} {:.1} A{r} {r} 0 0 1 {:.1} {:.1}" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round" opacity="{op}" />"#, 519.5 - r * 0.72, 140.0 - r * 0.72 - 6.0, 519.5 + r * 0.72, 140.0 - r * 0.72 - 6.0);
    }
    w!(o, r#"<circle cx="519.5" cy="138" r="3.5" fill="{INK}" />"#);
    // status
    w!(o, r#"<path d="{}" fill="{PANEL}" stroke="{BRIGHT_EDGE}" stroke-width="1.5" /><circle cx="56" cy="207" r="7" fill="{PHOSPHOR}" />{}"#, chamfer4(30.0, 187.0, 163.0, 40.0, 8.0), txt(74.0, 215.0, 21.0, 700, PHOSPHOR, "start", "Physics run"));
    w!(o, "{}", txt(30.0, 262.0, 18.5, 500, MUTED, "start", &format!("Minute ended {} s ago · Wi-Fi off · HV settled", 14 + (lt as u32 % 40))));
    w!(o, r#"<path d="{}" fill="{PANEL}" stroke="{HAIRLINE}" stroke-width="1.5" /><path d="M54 312 l7 7 l-7 7 l-7 -7 z" fill="{PINK}" />{}{}<path d="{}" fill="{RAISED}" stroke="{HAIRLINE}" stroke-width="1.5" /><rect x="503" y="316" width="17" height="17" fill="{INK}" />"#,
        chamfer(30.0, 283.0, 522.0, 78.0, 14.0), txt(84.0, 318.0, 20.0, 700, INK, "start", "Logging · External battery"), mono(84.0, 345.0, 15.0, MUTED, "start", 0.0, "17:41:08 · saved to iCloud"), chamfer4(483.0, 295.0, 57.0, 57.0, 10.0));
    // hero: the last minute's muon tracks
    w!(o, r#"<clipPath id="hero"><path d="{}" /></clipPath><path d="{}" fill="&#35;15101F" stroke="{VIOLET}" stroke-width="2" /><g clip-path="url(#hero)">"#, chamfer(30.0, 385.0, 522.0, 445.0, 18.0), chamfer(30.0, 385.0, 522.0, 445.0, 18.0));
    for i in 0..30u32 {
        let x0 = 30.0 + hash(i * 3) * 522.0 + (lt * (3.0 + 4.0 * hash(i))) % 40.0; let sl = (hash(i * 3 + 1) - 0.5) * 0.7;
        w!(o, r#"<line x1="{x0:.0}" y1="380" x2="{:.0}" y2="835" stroke="{LILAC}" stroke-width="{:.1}" opacity="{:.2}" />"#, x0 + sl * 455.0, 1.0 + hash(i * 3 + 2) * 1.2, 0.12 + 0.2 * hash(i * 3 + 2));
    }
    // a fresh bright track on every beat
    let beat = (lt / B).floor() as u32;
    for d in 0..5u32 {
        if beat < d { continue; }
        let n = beat - d; let age = (lt - n as f32 * B) / (5.0 * B);
        let x0 = 60.0 + hash(n * 7 + 500) * 460.0; let sl = (hash(n * 7 + 501) - 0.5) * 0.6;
        w!(o, r#"<line x1="{x0:.0}" y1="380" x2="{:.0}" y2="835" stroke="{INK}" stroke-width="3" opacity="{:.2}" />"#, x0 + sl * 455.0, (1.0 - age).max(0.0) * 0.9);
    }
    w!(o, "</g>");
    let rate = if lt < 1.5 { (60.0 * eo(seg(lt, 0.5, 1.5))).round() as i32 } else { 58 + (hash(bar + 40) * 5.0) as i32 };
    w!(o, "{}{}{}{}", mono(62.0, 642.0, 18.0, LILAC, "start", 1.0, "COINCIDENCES, LAST MINUTE"), mono(58.0, 770.0, 150.0, INK, "start", -4.0, &format!("{rate}")), txt(236.0, 768.0, 27.0, 700, PHOSPHOR, "start", "muons / min"), format!(r#"<path d="M73 794 H62 L68 801 L62 808 H73" fill="none" stroke="{MUTED}" stroke-width="2" />"#) + &mono(82.0, 808.0, 17.0, MUTED, "start", 0.0, &format!("CH · raw counts · {:02}:{:02}", 8, 25 + (lt / 4.0) as u32 % 30)));
    // channel tiles
    let chs = [("0", "1", 23.0f32), ("0", "2", 16.0), ("1", "2", 21.0)];
    for (i, (a, b, v)) in chs.iter().enumerate() {
        let x = 30.0 + i as f32 * 179.0;
        let val = count(*v, 0.6 + 0.2 * i as f32) as i32 + if lt > 2.0 { (hash(bar + i as u32 * 9) * 3.0) as i32 - 1 } else { 0 };
        w!(o, r#"<path d="{}" fill="{PANEL}" stroke="{HAIRLINE}" stroke-width="1.5" />{}{}{}"#, chamfer(x, 852.0, 163.0, 138.0, 14.0), ch_label(x + 18.0, 888.0, a, b, MUTED), mono(x + 18.0, 942.0, 44.0, INK, "start", 0.0, &format!("{val}")), spark(x + 18.0, 972.0, i as u32 * 20 + 3, lt));
    }
    // last hour
    w!(o, r#"<path d="{}" fill="url(#sheen)" stroke="{HAIRLINE}" stroke-width="1.5" />{}{}"#, chamfer(30.0, 1012.0, 522.0, 203.0, 16.0), txt(50.0, 1052.0, 23.0, 800, INK, "start", "Last hour"), mono(532.0, 1052.0, 15.0, MUTED, "end", 0.0, "mean 57.0 · 2 min gap"));
    let nb = ((lt / B * 1.7) as u32).min(60);
    for i in 0..nb {
        let h = 26.0 + 36.0 * hash(i + 300); let last = i == nb - 1 && nb == 60; let pulse = if i + 1 == nb { 1.0 + 0.4 * kick(t) } else { 1.0 };
        let hh = h * pulse; let x = 50.0 + i as f32 * 8.0;
        if i == 24 { w!(o, r#"<rect x="{x:.0}" y="1160" width="5" height="2" fill="{MUTED}" />"#); continue; }
        w!(o, r#"<rect x="{x:.0}" y="{:.0}" width="5" height="{hh:.0}" fill="{}" />"#, 1165.0 - hh, if last || i + 1 == nb { PHOSPHOR } else { "#2F7D5C" });
    }
    w!(o, "{}{}{}", mono(50.0, 1200.0, 14.0, MUTED, "start", 0.0, "07:26"), mono(291.0, 1200.0, 14.0, MUTED, "middle", 0.0, "07:56"), mono(532.0, 1200.0, 14.0, MUTED, "end", 0.0, "08:25 UTC"));
    // pressure and temperature
    w!(o, r#"<path d="{}" fill="url(#sheen)" stroke="{HAIRLINE}" stroke-width="1.5" /><path d="{}" fill="url(#sheen)" stroke="{HAIRLINE}" stroke-width="1.5" />"#, chamfer(30.0, 1237.0, 252.0, 140.0, 14.0), chamfer(299.0, 1237.0, 253.0, 140.0, 14.0));
    w!(o, "{}{}{}{}", mono(52.0, 1270.0, 15.5, VIOLET, "start", 2.0, "PRESSURE"), mono(52.0, 1314.0, 38.0, INK, "start", 0.0, "982.3"), txt(178.0, 1314.0, 22.0, 500, MUTED, "start", "hPa"), txt(52.0, 1352.0, 18.0, 500, MUTED, "start", "Falling 0.9 hPa in 3 h"));
    w!(o, "{}{}{}{}", mono(320.0, 1270.0, 15.5, PHOSPHOR, "start", 2.0, "DETECTOR TEMP"), mono(320.0, 1314.0, 38.0, INK, "start", 0.0, "24.0"), txt(427.0, 1314.0, 22.0, 500, MUTED, "start", "°C"), txt(320.0, 1352.0, 18.0, 500, MUTED, "start", "Steady · humidity 58 %"));
    // session totals
    let total = 60348.0 * eo(seg(lt, 1.0, 4.0)) + 1.3 * lt * 10.0;
    w!(o, r#"<path d="{}" fill="url(#sheen)" stroke="{HAIRLINE}" stroke-width="1.5" />{}{}{}{}{}"#, chamfer(30.0, 1400.0, 522.0, 175.0, 14.0), txt(50.0, 1440.0, 23.0, 800, INK, "start", "This session"), txt(532.0, 1440.0, 15.0, 500, MUTED, "end", "valid physics only"),
        mono(50.0, 1494.0, 32.0, INK, "start", 0.0, &group(total as i64)), mono(228.0, 1494.0, 32.0, INK, "start", 0.0, "17 h 41 m"), mono(410.0, 1494.0, 32.0, INK, "start", 0.0, "56.9"));
    w!(o, "{}{}{}", txt(50.0, 1522.0, 17.0, 500, MUTED, "start", "coincidences"), txt(228.0, 1522.0, 17.0, 500, MUTED, "start", "exposure"), txt(410.0, 1522.0, 17.0, 500, MUTED, "start", "mean /min"));
    o
}

fn group(n: i64) -> String {
    let s = n.to_string(); let mut o = String::new();
    for (i, c) in s.chars().enumerate() { if i > 0 && (s.len() - i) % 3 == 0 { o.push(','); } o.push(c); }
    o
}

/// the floating tab bar: Now (selected), Runs, Detector, Settings
pub fn tab_bar(x: f32, y: f32, w: f32) -> String {
    let mut o = String::new();
    w!(o, r#"<path d="{}" fill="&#35;16101F" stroke="{BRIGHT_EDGE}" stroke-width="1.5" />"#, chamfer4(x + 10.0, y, w - 20.0, 82.0, 16.0));
    let tw = (w - 40.0) / 4.0;
    for (i, name) in ["Now", "Runs", "Detector", "Settings"].iter().enumerate() {
        let cx = x + 20.0 + tw * i as f32 + tw / 2.0; let sel = i == 0;
        if sel { w!(o, r#"<path d="{}" fill="{BRIGHT_EDGE}" fill-opacity="0.45" stroke="{LILAC}" stroke-width="1.5" />"#, chamfer4(cx - tw / 2.0 + 4.0, y + 6.0, tw - 8.0, 70.0, 12.0)); }
        let c = if sel { LILAC } else { MUTED };
        match i {
            0 => { for r in [18.0f32, 10.0] { w!(o, r#"<circle cx="{cx:.0}" cy="{:.0}" r="{r}" fill="none" stroke="{c}" stroke-width="2.5" opacity="0.6" />"#, y + 34.0); } w!(o, r#"<circle cx="{cx:.0}" cy="{:.0}" r="4" fill="{c}" />"#, y + 34.0); }
            1 => { for k in 0..3 { w!(o, r#"<rect x="{:.0}" y="{:.0}" width="26" height="3.5" fill="{c}" />"#, cx - 13.0, y + 22.0 + k as f32 * 9.0); } }
            2 => { w!(o, r#"<rect x="{:.0}" y="{:.0}" width="24" height="24" fill="none" stroke="{c}" stroke-width="2.5" />"#, cx - 12.0, y + 21.0); }
            _ => { w!(o, r#"<circle cx="{cx:.0}" cy="{:.0}" r="11" fill="none" stroke="{c}" stroke-width="3.5" stroke-dasharray="5 4" />"#, y + 34.0); }
        }
        w!(o, "{}", txt(cx, y + 66.0, 16.0, 600, c, "middle", name));
    }
    o
}
