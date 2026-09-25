//! The TS EXIF code (`app/src/lib/exif/`) is the ORACLE for `src/exif.rs`.
//!
//! Every row of `tests/fixtures/exif/manifest.tsv` is one (fixture, operation)
//! pair whose expected output was produced by the TS oracle and committed. This
//! runs each row through the same `exif_*` exports the wasm build ships and
//! requires the bytes to match exactly. The vitest twin
//! (`app/src/lib/exif/exifOracle.test.ts`) runs the same rows against the BUILT
//! wasm and re-checks the goldens against the live TS oracle, so the goldens
//! cannot go stale against it silently.
use std::fs;
use std::path::PathBuf;

use stamp_tool::exif::{
    exif_apply_reencoded, exif_apply_verbatim, exif_read_tiff, exif_strip_metadata,
};

/// Pinned in `exifOracle.test.ts` too. A shrunk manifest would pass vacuously.
const EXPECTED_ROWS: usize = 281;

fn dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/exif")
}

fn read(name: &str) -> Vec<u8> {
    fs::read(dir().join(name)).unwrap_or_else(|e| panic!("reading fixture {name}: {e}"))
}

/// `None` when equal, else the first differing offset and both bytes.
fn byte_diff(expected: Option<&[u8]>, actual: Option<&[u8]>) -> Option<String> {
    match (expected, actual) {
        (None, None) => None,
        (Some(_), None) => Some("expected bytes, got null".into()),
        (None, Some(_)) => Some("expected null, got bytes".into()),
        (Some(e), Some(a)) => {
            if let Some(i) = e.iter().zip(a).position(|(x, y)| x != y) {
                return Some(format!(
                    "offset {i}: expected 0x{:x}, actual 0x{:x} (len {} vs {})",
                    e[i],
                    a[i],
                    e.len(),
                    a.len()
                ));
            }
            (e.len() != a.len())
                .then(|| format!("length {} vs {} (equal prefix)", e.len(), a.len()))
        }
    }
}

#[test]
fn every_row_matches_the_ts_oracle_byte_for_byte() {
    let manifest = fs::read_to_string(dir().join("manifest.tsv")).expect("manifest.tsv");
    let mut rows = 0usize;
    let mut bad = Vec::new();
    for line in manifest
        .lines()
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
    {
        let f: Vec<&str> = line.split('\t').collect();
        assert_eq!(f.len(), 8, "malformed manifest row: {line}");
        let (fixture, op, mime, format) = (f[0], f[1], f[2], f[3]);
        let width: u32 = f[4].parse().expect("width");
        let height: u32 = f[5].parse().expect("height");
        let input = read(&format!("{fixture}.in.bin"));
        let tiff = (f[6] != "-").then(|| read(f[6]));
        let golden = (f[7] != "null").then(|| read(f[7]));

        let actual: Option<Vec<u8>> = match op {
            "read" => exif_read_tiff(&input, mime),
            "strip_all" => Some(exif_strip_metadata(&input, "all")),
            "strip_location" => Some(exif_strip_metadata(&input, "location")),
            "verbatim_keep" => Some(exif_apply_verbatim(&input, mime, "keep", "all")),
            "verbatim_strip_all" => Some(exif_apply_verbatim(&input, mime, "strip", "all")),
            "verbatim_strip_location" => {
                Some(exif_apply_verbatim(&input, mime, "strip", "location"))
            }
            "reencoded_strip_a" => Some(exif_apply_reencoded(
                &input, format, "strip", tiff, width, height,
            )),
            o if o.starts_with("reencoded_keep") => Some(exif_apply_reencoded(
                &input, format, "keep", tiff, width, height,
            )),
            other => panic!("unknown op {other} in manifest"),
        };
        if let Some(d) = byte_diff(golden.as_deref(), actual.as_deref()) {
            bad.push(format!("{fixture} × {op}: {d}"));
        }
        rows += 1;
    }
    assert_eq!(rows, EXPECTED_ROWS, "manifest row count");
    assert!(
        bad.is_empty(),
        "{} row(s) differ from the TS oracle:\n{}",
        bad.len(),
        bad.join("\n")
    );
}
