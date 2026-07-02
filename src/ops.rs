//! Operation log — a serializable, replayable history of edits over a
//! [`TileBuffer`].
//!
//! Feature-gated behind `tiles`; not part of the wasm build. The log is the
//! source of truth for undo/redo and future content-addressed persistence:
//! every edit is an [`Op`], appended in order, with periodic keyframe snapshots
//! so replay does not have to start from scratch.
//!
//! ## Apply fidelity (today)
//! Recording *every* op with full fidelity matters now; full *replay* parity is
//! paired work. [`FillRegion`](Op::FillRegion), [`Crop`](Op::Crop) and
//! [`Levels`](Op::Levels) are implemented as pure, verifiable functions. The
//! rest ([`Stroke`](Op::Stroke), [`Blur`](Op::Blur), text/shape) are recorded
//! faithfully but apply as **no-ops** — see the `TODO`s in [`apply`].
//!
//! ## Serialization
//! Each op serializes as `[format-version byte] ++ postcard(op)`. A bumped
//! version is rejected cleanly by [`decode_op`], so old logs never silently
//! mis-decode against a newer schema. See DECISION D1/D2/D3 in SESSION_LOG.

use crate::tiles::TileBuffer;
use serde::{Deserialize, Serialize};

/// Leading byte on every encoded op. Bump when the schema changes
/// incompatibly.
pub const OP_FORMAT_VERSION: u8 = 1;

/// Number of ops between keyframe snapshots. Replay restores the nearest
/// keyframe at or before the target, then applies the remainder.
pub const KEYFRAME_INTERVAL: usize = 50;

/// Axis-aligned rectangle in canvas pixel coords.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

/// Straight (non-premultiplied) RGBA colour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

/// Brush parameters for a freehand stroke. Compact, serializable mirror of the
/// paint-driver args (`size`, `hardness`, `opacity` + colour) — see D1.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Brush {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    /// Diameter in pixels.
    pub size: f32,
    /// 0.0 (soft) .. 1.0 (hard).
    pub hardness: f32,
    /// 0.0 .. 1.0.
    pub opacity: f32,
}

/// Gaussian-blur parameters. `intensity` mirrors `blur_region`'s kernel-radius
/// arg (1..=30).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlurParams {
    pub intensity: u32,
}

/// Levels remap (D2): `black`/`white` input points and output `gamma`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LevelsParams {
    pub black: u8,
    pub white: u8,
    pub gamma: f32,
}

/// Compact, serializable text-annotation parameters (D1). This is a subset of
/// the engine's render-time `TextAnnotation` (which additionally carries a
/// non-serializable `Arc<Vec<u8>>` glyph-render cache); full conversion is
/// paired work when text replay lands.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextParams {
    pub id: u32,
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub font_size: f32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub bold: bool,
    pub rotation_deg: f64,
}

/// Compact, serializable shape-annotation parameters (D1). Subset of the
/// engine's `ShapeAnnotation`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShapeParams {
    pub id: u32,
    pub kind: u8,
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub stroke_width: f64,
    pub points: Vec<(f64, f64)>,
}

/// A single recorded edit.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Op {
    /// Freehand brush stroke. Recorded; apply is a TODO no-op.
    Stroke {
        points: Vec<(f32, f32)>,
        brush: Brush,
    },
    /// Fill a rectangle with a flat colour. **Applied.**
    FillRegion { rect: Rect, color: Rgba },
    /// Gaussian blur within a rect. Recorded; apply is a TODO no-op.
    Blur { rect: Rect, params: BlurParams },
    /// Black/white/gamma remap over the whole canvas. **Applied.**
    Levels(LevelsParams),
    /// Crop to a rectangle, changing logical bounds. **Applied.**
    Crop { rect: Rect },
    /// Add a text annotation. Recorded; apply is a TODO no-op.
    TextAdd(TextParams),
    /// Edit an existing text annotation. Recorded; apply is a TODO no-op.
    TextEdit(TextParams),
    /// Remove a text annotation by id. Recorded; apply is a TODO no-op.
    TextRemove { id: u32 },
    /// Add a shape annotation. Recorded; apply is a TODO no-op.
    ShapeAdd(ShapeParams),
    /// Remove a shape annotation by id. Recorded; apply is a TODO no-op.
    ShapeRemove { id: u32 },
    /// Non-destructive content translation of a layer (D3). Recorded; apply is
    /// a TODO no-op.
    LayerMove { layer: u32, dx: i32, dy: i32 },
}

/// Errors from decoding an encoded op.
#[derive(Debug, PartialEq, Eq)]
pub enum OpError {
    /// Byte stream was empty (no version byte).
    Empty,
    /// Version byte did not match [`OP_FORMAT_VERSION`].
    UnsupportedVersion(u8),
    /// Payload failed to deserialize.
    Decode,
}

impl std::fmt::Display for OpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpError::Empty => write!(f, "empty op byte stream"),
            OpError::UnsupportedVersion(v) => {
                write!(
                    f,
                    "unsupported op format version {v} (expected {OP_FORMAT_VERSION})"
                )
            }
            OpError::Decode => write!(f, "op payload failed to decode"),
        }
    }
}

impl std::error::Error for OpError {}

/// Encode an op as `[version byte] ++ postcard(op)`.
pub fn encode_op(op: &Op) -> Vec<u8> {
    let mut out = Vec::with_capacity(32);
    out.push(OP_FORMAT_VERSION);
    // postcard serialization of a plain data enum is infallible in practice;
    // if it ever fails we surface an empty-payload stream rather than panic.
    if let Ok(body) = postcard::to_allocvec(op) {
        out.extend_from_slice(&body);
    }
    out
}

/// Decode an op, validating the leading version byte first.
pub fn decode_op(bytes: &[u8]) -> Result<Op, OpError> {
    let (&ver, body) = bytes.split_first().ok_or(OpError::Empty)?;
    if ver != OP_FORMAT_VERSION {
        return Err(OpError::UnsupportedVersion(ver));
    }
    postcard::from_bytes(body).map_err(|_| OpError::Decode)
}

/// Apply a single op to a tile buffer.
///
/// Only [`Op::FillRegion`], [`Op::Crop`] and [`Op::Levels`] mutate the buffer
/// today; the rest are faithful recordings that apply as no-ops (TODO: replay
/// parity is paired work).
pub fn apply(op: &Op, buf: &mut TileBuffer) {
    match op {
        Op::FillRegion { rect, color } => {
            let c = [color.r, color.g, color.b, color.a];
            let x0 = rect.x.max(0);
            let y0 = rect.y.max(0);
            let x1 = (rect.x + rect.w as i32).min(buf.width() as i32).max(x0);
            let y1 = (rect.y + rect.h as i32).min(buf.height() as i32).max(y0);
            for y in y0..y1 {
                for x in x0..x1 {
                    buf.set_pixel(x, y, c);
                }
            }
        }
        Op::Crop { rect } => {
            // Clamp the rect to the current bounds, mirroring the engine's own
            // crop clamping, then rebuild the buffer from the cropped region.
            let x = rect.x.clamp(0, buf.width() as i32);
            let y = rect.y.clamp(0, buf.height() as i32);
            let w = (rect.w).min((buf.width() as i32 - x).max(0) as u32);
            let h = (rect.h).min((buf.height() as i32 - y).max(0) as u32);
            let region = buf.get_region(x, y, w, h);
            buf.blit_from_flat(&region, w, h);
        }
        Op::Levels(p) => {
            let lut = build_levels_lut(p);
            buf.map_pixels_mut(|px| {
                // Leave fully-transparent pixels untouched so transparent space
                // (incl. edge-tile padding) stays pristine and hashes stably.
                if px[3] == 0 {
                    px
                } else {
                    [
                        lut[px[0] as usize],
                        lut[px[1] as usize],
                        lut[px[2] as usize],
                        px[3],
                    ]
                }
            });
        }
        // TODO(replay-parity): recorded faithfully; apply once the brush,
        // blur, and annotation engines are wired to the tile buffer.
        Op::Stroke { .. }
        | Op::Blur { .. }
        | Op::TextAdd(_)
        | Op::TextEdit(_)
        | Op::TextRemove { .. }
        | Op::ShapeAdd(_)
        | Op::ShapeRemove { .. }
        | Op::LayerMove { .. } => {}
    }
}

/// Precompute the 256-entry levels remap for a channel value.
fn build_levels_lut(p: &LevelsParams) -> [u8; 256] {
    let lo = p.black as f32;
    let hi = p.white as f32;
    let denom = (hi - lo).max(1.0);
    let inv_gamma = 1.0 / p.gamma.max(0.01);
    let mut lut = [0u8; 256];
    for (v, out) in lut.iter_mut().enumerate() {
        let t = ((v as f32 - lo) / denom).clamp(0.0, 1.0);
        let t = t.powf(inv_gamma);
        *out = (t * 255.0).round().clamp(0.0, 255.0) as u8;
    }
    lut
}

/// An append-only, keyframed, replayable operation log over a `TileBuffer`.
///
/// The log owns a `live` buffer kept in sync with the ops, plus keyframe
/// snapshots taken every [`KEYFRAME_INTERVAL`] ops (and one at index 0). Undo
/// is [`truncate`](Self::truncate); branching is `truncate` then `append`
/// (drops the tail — linear history for now).
pub struct OpLog {
    ops: Vec<Op>,
    /// `(op_count_at_snapshot, buffer_state_after_that_many_ops)`.
    keyframes: Vec<(usize, TileBuffer)>,
    live: TileBuffer,
}

impl OpLog {
    /// A new log over an empty `width`×`height` canvas. Index-0 keyframe is the
    /// initial empty state.
    pub fn new(width: u32, height: u32) -> Self {
        let live = TileBuffer::new(width, height);
        Self {
            ops: Vec::new(),
            keyframes: vec![(0, live.clone())],
            live,
        }
    }

    /// Number of ops currently in the log.
    pub fn len(&self) -> usize {
        self.ops.len()
    }

    /// Whether the log has no ops.
    pub fn is_empty(&self) -> bool {
        self.ops.is_empty()
    }

    /// Read-only view of the recorded ops.
    pub fn ops(&self) -> &[Op] {
        &self.ops
    }

    /// The live buffer (state after all ops).
    pub fn buffer(&self) -> &TileBuffer {
        &self.live
    }

    /// Append and apply an op. Takes a keyframe snapshot when the op count hits
    /// a multiple of [`KEYFRAME_INTERVAL`].
    pub fn append(&mut self, op: Op) {
        apply(&op, &mut self.live);
        self.ops.push(op);
        if self.ops.len().is_multiple_of(KEYFRAME_INTERVAL) {
            self.keyframes.push((self.ops.len(), self.live.clone()));
        }
    }

    /// Undo to exactly `n` ops (truncate-on-branch). Drops ops and keyframes
    /// past `n` and rebuilds the live buffer to the state at `n`. A subsequent
    /// [`append`](Self::append) therefore drops the old tail.
    pub fn truncate(&mut self, n: usize) {
        if n >= self.ops.len() {
            return;
        }
        self.ops.truncate(n);
        self.keyframes.retain(|(idx, _)| *idx <= n);
        // Rebuild live from the nearest surviving keyframe.
        self.live = self.rebuilt_to(n);
    }

    /// Replay the whole log into `out`, starting from the nearest keyframe at or
    /// before the end (the fast path).
    pub fn replay(&self, out: &mut TileBuffer) {
        *out = self.rebuilt_to(self.ops.len());
    }

    /// Replay the whole log into `out` from the index-0 keyframe, ignoring later
    /// keyframes (the reference/slow path — used to prove keyframe replay
    /// matches full replay).
    pub fn replay_full(&self, out: &mut TileBuffer) {
        let (_, base) = &self.keyframes[0];
        let mut buf = base.clone();
        for op in &self.ops {
            apply(op, &mut buf);
        }
        *out = buf;
    }

    /// Build the buffer state after the first `n` ops using the nearest
    /// keyframe at or before `n`.
    fn rebuilt_to(&self, n: usize) -> TileBuffer {
        let (kf_idx, base) = self
            .keyframes
            .iter()
            .filter(|(idx, _)| *idx <= n)
            .max_by_key(|(idx, _)| *idx)
            .expect("index-0 keyframe always exists");
        let mut buf = base.clone();
        for op in &self.ops[*kf_idx..n] {
            apply(op, &mut buf);
        }
        buf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_ops() -> Vec<Op> {
        vec![
            Op::Stroke {
                points: vec![(1.0, 2.0), (3.5, 4.5)],
                brush: Brush {
                    r: 10,
                    g: 20,
                    b: 30,
                    a: 255,
                    size: 12.0,
                    hardness: 0.8,
                    opacity: 0.5,
                },
            },
            Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 10,
                    h: 10,
                },
                color: Rgba {
                    r: 1,
                    g: 2,
                    b: 3,
                    a: 255,
                },
            },
            Op::Blur {
                rect: Rect {
                    x: 5,
                    y: 5,
                    w: 20,
                    h: 20,
                },
                params: BlurParams { intensity: 7 },
            },
            Op::Levels(LevelsParams {
                black: 16,
                white: 235,
                gamma: 1.2,
            }),
            Op::Crop {
                rect: Rect {
                    x: 2,
                    y: 2,
                    w: 100,
                    h: 100,
                },
            },
            Op::TextAdd(TextParams {
                id: 1,
                text: "hi".into(),
                x: 3,
                y: 4,
                font_size: 18.0,
                r: 0,
                g: 0,
                b: 0,
                bold: true,
                rotation_deg: 12.5,
            }),
            Op::TextEdit(TextParams {
                id: 1,
                text: "bye".into(),
                x: 3,
                y: 4,
                font_size: 18.0,
                r: 0,
                g: 0,
                b: 0,
                bold: false,
                rotation_deg: 0.0,
            }),
            Op::TextRemove { id: 1 },
            Op::ShapeAdd(ShapeParams {
                id: 2,
                kind: 1,
                x0: 0.0,
                y0: 0.0,
                x1: 10.0,
                y1: 10.0,
                r: 255,
                g: 0,
                b: 0,
                stroke_width: 2.0,
                points: vec![(1.0, 1.0), (2.0, 2.0)],
            }),
            Op::ShapeRemove { id: 2 },
            Op::LayerMove {
                layer: 0,
                dx: -5,
                dy: 7,
            },
        ]
    }

    #[test]
    fn postcard_round_trip_every_variant() {
        for op in sample_ops() {
            let bytes = encode_op(&op);
            assert_eq!(bytes[0], OP_FORMAT_VERSION, "version byte prefix");
            let back = decode_op(&bytes).expect("decode");
            assert_eq!(op, back, "round-trip mismatch for {op:?}");
        }
    }

    #[test]
    fn version_byte_rejects_bumped_version() {
        let op = Op::TextRemove { id: 9 };
        let mut bytes = encode_op(&op);
        bytes[0] = OP_FORMAT_VERSION + 1;
        assert_eq!(
            decode_op(&bytes),
            Err(OpError::UnsupportedVersion(OP_FORMAT_VERSION + 1))
        );
        assert_eq!(decode_op(&[]), Err(OpError::Empty));
    }

    #[test]
    fn fill_region_applies_and_clamps_to_bounds() {
        let mut buf = TileBuffer::new(300, 300);
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 290,
                    y: 290,
                    w: 50,
                    h: 50,
                },
                color: Rgba {
                    r: 9,
                    g: 8,
                    b: 7,
                    a: 255,
                },
            },
            &mut buf,
        );
        assert_eq!(buf.get_pixel(299, 299), [9, 8, 7, 255]);
        // Out of bounds was clamped away — nothing materialised past the edge.
        assert_eq!(buf.get_pixel(300, 300), [0, 0, 0, 0]);
    }

    #[test]
    fn crop_changes_bounds_and_content() {
        let mut buf = TileBuffer::new(300, 300);
        // Mark a distinctive pixel at (60,60).
        buf.set_pixel(60, 60, [1, 2, 3, 255]);
        apply(
            &Op::Crop {
                rect: Rect {
                    x: 50,
                    y: 50,
                    w: 100,
                    h: 100,
                },
            },
            &mut buf,
        );
        assert_eq!(buf.width(), 100);
        assert_eq!(buf.height(), 100);
        // (60,60) is now (10,10) after the crop origin shift.
        assert_eq!(buf.get_pixel(10, 10), [1, 2, 3, 255]);
    }

    #[test]
    fn levels_is_pure_and_leaves_transparent_pixels() {
        let mut buf = TileBuffer::new(4, 4);
        buf.set_pixel(0, 0, [100, 100, 100, 255]);
        buf.set_pixel(1, 0, [100, 100, 100, 0]); // transparent — must not change
        apply(
            &Op::Levels(LevelsParams {
                black: 0,
                white: 255,
                gamma: 1.0,
            }),
            &mut buf,
        );
        // Identity levels (0..255, gamma 1) leaves opaque pixels unchanged.
        assert_eq!(buf.get_pixel(0, 0), [100, 100, 100, 255]);
        assert_eq!(buf.get_pixel(1, 0), [100, 100, 100, 0]);

        // A real remap changes opaque RGB but not the transparent pixel's RGB.
        apply(
            &Op::Levels(LevelsParams {
                black: 64,
                white: 192,
                gamma: 1.0,
            }),
            &mut buf,
        );
        assert_ne!(buf.get_pixel(0, 0)[0], 100);
        assert_eq!(buf.get_pixel(1, 0), [100, 100, 100, 0]);
    }

    /// Build a log with `n` mixed ops (deterministic).
    fn mixed_log(n: usize) -> OpLog {
        let mut log = OpLog::new(512, 512);
        for i in 0..n {
            let op = match i % 3 {
                0 => Op::FillRegion {
                    rect: Rect {
                        x: (i % 400) as i32,
                        y: (i % 400) as i32,
                        w: 20,
                        h: 20,
                    },
                    color: Rgba {
                        r: (i as u8),
                        g: 100,
                        b: 50,
                        a: 255,
                    },
                },
                1 => Op::Levels(LevelsParams {
                    black: 8,
                    white: 240,
                    gamma: 1.05,
                }),
                _ => Op::Stroke {
                    points: vec![(i as f32, i as f32)],
                    brush: Brush {
                        r: 0,
                        g: 0,
                        b: 0,
                        a: 255,
                        size: 4.0,
                        hardness: 1.0,
                        opacity: 1.0,
                    },
                },
            };
            log.append(op);
        }
        log
    }

    #[test]
    fn replay_is_deterministic() {
        let log = mixed_log(120);
        let mut a = TileBuffer::new(0, 0);
        let mut b = TileBuffer::new(0, 0);
        log.replay(&mut a);
        log.replay(&mut b);
        assert_eq!(a.content_hash(), b.content_hash());
        // And matches the live buffer the log maintained while appending.
        assert_eq!(a.content_hash(), log.buffer().content_hash());
    }

    #[test]
    fn keyframe_replay_equals_full_replay() {
        // 120 ops => keyframes at 0, 50, 100.
        let log = mixed_log(120);
        assert!(log.keyframes.len() >= 3, "expected multiple keyframes");
        let mut fast = TileBuffer::new(0, 0);
        let mut full = TileBuffer::new(0, 0);
        log.replay(&mut fast); // nearest keyframe (100) + 20 ops
        log.replay_full(&mut full); // from index 0
        assert_eq!(fast.content_hash(), full.content_hash());
    }

    #[test]
    fn undo_truncate_correctness() {
        let mut log = mixed_log(70);
        let hash_full = log.buffer().content_hash();

        // Snapshot the state at 60 ops via an independent rebuild.
        let log60 = mixed_log(60);
        let hash60 = log60.buffer().content_hash();

        // Truncate the 70-op log back to 60 — must match the freshly-built 60.
        log.truncate(60);
        assert_eq!(log.len(), 60);
        assert_eq!(log.buffer().content_hash(), hash60);
        assert_ne!(log.buffer().content_hash(), hash_full);

        // Branch: append a new op after the undo. Tail is gone; history linear.
        log.append(Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 5,
                h: 5,
            },
            color: Rgba {
                r: 200,
                g: 0,
                b: 0,
                a: 255,
            },
        });
        assert_eq!(log.len(), 61);
        let mut replayed = TileBuffer::new(0, 0);
        log.replay(&mut replayed);
        assert_eq!(replayed.content_hash(), log.buffer().content_hash());
    }
}
