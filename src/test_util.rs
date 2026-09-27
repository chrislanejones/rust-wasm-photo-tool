// Helpers shared by the crate's unit-test modules. Only compiled for tests.

/// A `w×h` RGBA buffer of one repeated pixel. There were eleven private copies
/// of this across the test modules (Track A, docs/AppShell-Refactor-Plan.md);
/// they differed in style only — every one produced the same bytes.
pub(crate) fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
    let mut v = Vec::with_capacity((w * h * 4) as usize);
    for _ in 0..(w * h) {
        v.extend_from_slice(&rgba);
    }
    v
}
