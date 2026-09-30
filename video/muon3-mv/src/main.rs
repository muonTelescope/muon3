use muon3_mv::{MusicVideo, HEIGHT, WIDTH};
use fframes::{EncoderOptions, MediaDirectory, RenderOptions, cli};
use fframes_skia_renderer::{SkiaFFramesRenderer, SkiaPipelineConcurrencyPolicy, SkiaPipelineConfig, metal::SkiaMetalCtx};
use std::process::ExitCode;

/// Standard fframes commands: render, frame, strip, onion, inspect, timeline, audio, preview (`--help`).
#[derive(Debug, clap::Args)]
struct VideoArgs {}

use fframes::cli::clap;

fn main() -> ExitCode {
    let args = cli::parse::<VideoArgs>();
    // runtime media directory: fonts, images and the song are read at run time
    let dir = MediaDirectory::read_folder(concat!(env!("CARGO_MANIFEST_DIR"), "/media")).expect("media folder");
    let media = dir.process_media_source().expect("media");
    let video = MusicVideo::new();
    let gpu = SkiaMetalCtx::new(WIDTH, HEIGHT).expect("GPU context");

    cli::new(
        &video,
        RenderOptions {
            media: Some(&media),
            video_encoder_options: EncoderOptions {
                preferred_encoder: Some("libx264"),
                codec_params: Some(&[("crf", "18"), ("preset", "medium"), ("tune", "animation")]),
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .args(args)
    .backend(
        SkiaFFramesRenderer::new_metal(
            &gpu,
            SkiaPipelineConfig { concurrency_policy: SkiaPipelineConcurrencyPolicy::MaxPerformance, ..Default::default() },
        )
        .expect("skia renderer"),
    )
    .preview(fframes_native_player::cli_preview)
    .run()
}
