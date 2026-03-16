/// Pixel filters — brightness, contrast, and future additions.
///
/// All functions operate on raw RGBA pixel buffers in-place.
/// The `push_snapshot` calls happen in the lib.rs glue layer before calling these.

/// Shift all RGB channels by `delta` (−1.0 to +1.0 mapped to −255..+255).
pub fn adjust_brightness(data: &mut [u8], delta: f64) {
    let d = (delta.clamp(-1.0, 1.0) * 255.0).round() as i32;
    for i in (0..data.len()).step_by(4) {
        data[i]     = (data[i] as i32 + d).clamp(0, 255) as u8;
        data[i + 1] = (data[i + 1] as i32 + d).clamp(0, 255) as u8;
        data[i + 2] = (data[i + 2] as i32 + d).clamp(0, 255) as u8;
    }
}

/// Scale contrast around midpoint 0.5. `factor`: 0 = grey, 1 = unchanged, 2 = doubled.
pub fn adjust_contrast(data: &mut [u8], factor: f64) {
    let f = factor.clamp(0.0, 4.0);
    for i in (0..data.len()).step_by(4) {
        for c in 0..3 {
            let v = data[i + c] as f64 / 255.0;
            let adj = ((v - 0.5) * f + 0.5).clamp(0.0, 1.0);
            data[i + c] = (adj * 255.0).round() as u8;
        }
    }
}
