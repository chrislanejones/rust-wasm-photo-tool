//! `get_layers()` must always emit VALID JSON, whatever opacity it is handed.
//!
//! Backlog #79 was filed as "NaN → invalid JSON from `get_layers()`" and marked
//! *unreachable*, on the reasoning that the only opacity control is an
//! `<input type="range">` whose value is always numeric. That reasoning is
//! correct about the slider and wrong about the document: an OpenRaster import
//! reads opacity out of the file.
//!
//!   stackXml.ts:104   opacity: opacityAttr ? parseFloat(opacityAttr) : 1
//!   import.ts:97      tool.push_restored_layer(…, layer.opacity)
//!   layer.rs          opacity: opacity.clamp(0.0, 1.0)
//!
//! `parseFloat("abc")` is NaN, and `opacityAttr` is truthy for any non-empty
//! string, so a `.ora` carrying `opacity="abc"` reaches the engine as NaN.
//!
//! ⚠️ `f64::clamp` DOES NOT SANITISE NaN — it is specified to return NaN when
//! self is NaN. (Infinity IS handled: `f64::INFINITY.clamp(0.0, 1.0)` == 1.0,
//! which is why this looked guarded.) The NaN then formats as the bare token
//! `NaN`, which is not JSON: `JSON.parse` throws, `useEngineCore` catches, and
//! `layers` becomes `[]` — the whole layer panel empties and the document looks
//! like it lost every layer.
//!
//! The engine is the right place to stop this. It owns the JSON, and a caller
//! that has to remember not to pass NaN is a caller that eventually forgets.
use stamp_tool::ImageHorseTool;

const W: u32 = 8;
const H: u32 = 8;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![128u8; (W * H * 4) as usize]);
    t
}

/// Minimal JSON well-formedness check, sufficient for this shape and with no
/// new dependency: the bare tokens JS rejects are `NaN`, `Infinity` and
/// `-Infinity`, and none of them can appear inside a layer NAME because
/// `json_escape` would quote it — every occurrence here is a numeric field.
fn is_parseable_json(s: &str) -> bool {
    !s.contains("NaN") && !s.contains("Infinity")
}

#[test]
fn push_restored_layer_with_nan_opacity_still_emits_valid_json() {
    let mut t = tool();
    t.push_restored_layer(
        &vec![255u8; (W * H * 4) as usize],
        W,
        H,
        "from .ora",
        true,
        f64::NAN,
    );
    let json = t.get_layers();
    assert!(
        is_parseable_json(&json),
        "get_layers() emitted a bare NaN/Infinity token, which JSON.parse rejects: {json}"
    );
}

#[test]
fn set_layer_opacity_rejects_non_finite() {
    let mut t = tool();
    let id = t.add_layer("L");

    // NaN and both infinities must leave the layer with a usable opacity.
    for bad in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        t.set_layer_opacity(id, bad);
        let json = t.get_layers();
        assert!(
            is_parseable_json(&json),
            "opacity {bad} produced unparseable JSON: {json}"
        );
    }
}

/// The `"opacity":N` belonging to ONE layer, found by its id.
///
/// ⚠️ Written because the obvious `json.contains("\"opacity\":1")` is VACUOUS:
/// the Background layer is always opacity 1, so that assertion passes no matter
/// what the layer under test holds — it would have gone green against a
/// completely broken clamp. Anchor on the id, always.
fn opacity_of(json: &str, id: u32) -> String {
    let key = format!("\"id\":{id},");
    let start = json
        .find(&key)
        .expect("layer id not present in get_layers()");
    let seg = &json[start..];
    let end = seg.find('}').unwrap_or(seg.len());
    let seg = &seg[..end];
    let o = seg
        .find("\"opacity\":")
        .expect("no opacity field for that layer");
    let rest = &seg[o + "\"opacity\":".len()..];
    let stop = rest.find(',').unwrap_or(rest.len());
    rest[..stop].to_string()
}

#[test]
fn ordinary_opacities_are_unchanged() {
    // The guard must not disturb the values that were always fine, including
    // the clamping behaviour that already worked.
    let mut t = tool();
    let id = t.add_layer("L");

    t.set_layer_opacity(id, 0.5);
    assert_eq!(opacity_of(&t.get_layers(), id), "0.5");

    t.set_layer_opacity(id, 2.0); // out of range, clamps DOWN to 1
    assert_eq!(opacity_of(&t.get_layers(), id), "1");

    t.set_layer_opacity(id, -3.0); // clamps UP to 0
    assert_eq!(opacity_of(&t.get_layers(), id), "0");

    // And the sanitised value is 1.0, not "left at whatever it was".
    t.set_layer_opacity(id, f64::NAN);
    assert_eq!(opacity_of(&t.get_layers(), id), "1");
}
