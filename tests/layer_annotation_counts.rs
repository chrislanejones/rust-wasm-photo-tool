//! `get_layers()` reports each layer's live annotation counts, PER LAYER.
//!
//! Backlog #63 wants a badge in the Layers panel showing how many text and
//! shape annotations a layer carries. The counts are `Vec::len()` on fields
//! the layer already owns, so they ride in the layer JSON rather than behind
//! a getter of their own.
//!
//! What is worth pinning here is not "len() returns a number" — it is that the
//! numbers are **scoped to the layer they describe**. Every annotation getter
//! and hit-test in the engine is active-layer-only while the canvas renders all
//! visible layers, which has produced real crosstalk bugs before. A count that
//! silently reported the ACTIVE layer's annotations for every row would look
//! completely correct on a single-layer document — the only kind most tests
//! build — and be wrong the moment a second layer exists.
//!
//! So every assertion below reads a SPECIFIC layer's object out of the JSON by
//! id, never "the first one" or "the active one".
use stamp_tool::ImageHorseTool;

const W: u32 = 8;
const H: u32 = 8;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![128u8; (W * H * 4) as usize]);
    t
}

/// Pull one integer field out of the layer object with this id.
///
/// Anchored on the id, deliberately: a positional read ("the second layer")
/// silently follows a reorder and turns into a test of nothing.
fn field_of(json: &str, id: u32, key: &str) -> i64 {
    let needle = format!("\"id\":{id},");
    let start = json
        .find(&needle)
        .unwrap_or_else(|| panic!("layer id {id} not present in get_layers(): {json}"));
    let obj_end = json[start..]
        .find('}')
        .map(|e| start + e)
        .expect("unterminated layer object");
    let obj = &json[start..obj_end];
    let k = format!("\"{key}\":");
    let ks = obj
        .find(&k)
        .unwrap_or_else(|| panic!("key {key} not present on layer {id}: {obj}"));
    let rest = &obj[ks + k.len()..];
    let end = rest
        .find(|c: char| !c.is_ascii_digit() && c != '-')
        .unwrap_or(rest.len());
    rest[..end]
        .parse()
        .unwrap_or_else(|e| panic!("{key} on layer {id} is not an integer ({e}): {obj}"))
}

fn add_a_shape(t: &mut ImageHorseTool) -> u32 {
    t.add_shape_annotation(
        0, 1.0, 1.0, 5.0, 5.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
    )
}

fn add_some_text(t: &mut ImageHorseTool) -> u32 {
    t.add_text_annotation(
        "hi", 12.0, 0, 0, 0, false, 2, 2, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
    )
}

#[test]
fn a_fresh_layer_reports_zero_of_each() {
    let t = tool();
    let id = t.active_layer_id();
    assert_eq!(field_of(&t.get_layers(), id, "textCount"), 0);
    assert_eq!(field_of(&t.get_layers(), id, "shapeCount"), 0);
}

#[test]
fn adding_a_shape_moves_shape_count_and_leaves_text_count_alone() {
    let mut t = tool();
    let id = t.active_layer_id();
    add_a_shape(&mut t);
    assert_eq!(field_of(&t.get_layers(), id, "shapeCount"), 1);
    assert_eq!(
        field_of(&t.get_layers(), id, "textCount"),
        0,
        "a shape must not be counted as text"
    );
}

#[test]
fn adding_text_moves_text_count_and_leaves_shape_count_alone() {
    let mut t = tool();
    let id = t.active_layer_id();
    add_some_text(&mut t);
    assert_eq!(field_of(&t.get_layers(), id, "textCount"), 1);
    assert_eq!(
        field_of(&t.get_layers(), id, "shapeCount"),
        0,
        "text must not be counted as a shape"
    );
}

/// THE test. Two layers, different contents, both read at once.
#[test]
fn counts_are_scoped_to_their_own_layer_not_the_active_one() {
    let mut t = tool();
    let lower = t.active_layer_id();

    // Two shapes and one text on the lower layer.
    add_a_shape(&mut t);
    add_a_shape(&mut t);
    add_some_text(&mut t);

    // A new layer above, which becomes active, carrying one shape only.
    let upper = t.add_layer("Upper");
    assert_eq!(
        t.active_layer_id(),
        upper,
        "control: add_layer activates it"
    );
    add_a_shape(&mut t);

    let json = t.get_layers();
    assert_eq!(field_of(&json, lower, "shapeCount"), 2, "lower shapes");
    assert_eq!(field_of(&json, lower, "textCount"), 1, "lower text");
    assert_eq!(field_of(&json, upper, "shapeCount"), 1, "upper shapes");
    assert_eq!(field_of(&json, upper, "textCount"), 0, "upper text");

    // And the numbers do not move when the SELECTION moves — the failure this
    // test exists for is counts that follow the active layer.
    assert!(t.set_active_layer(lower), "control: lower layer exists");
    let json = t.get_layers();
    assert_eq!(
        field_of(&json, upper, "shapeCount"),
        1,
        "upper's count changed when it stopped being active"
    );
    assert_eq!(
        field_of(&json, lower, "shapeCount"),
        2,
        "lower's count changed when it became active"
    );
}

#[test]
fn removing_a_shape_lowers_only_that_layers_count() {
    let mut t = tool();
    let lower = t.active_layer_id();
    let doomed = add_a_shape(&mut t);
    add_a_shape(&mut t);

    let upper = t.add_layer("Upper");
    add_a_shape(&mut t);

    assert!(t.set_active_layer(lower), "control: lower layer exists");
    assert!(
        t.remove_shape_annotation(doomed),
        "control: the shape was removable"
    );

    let json = t.get_layers();
    assert_eq!(field_of(&json, lower, "shapeCount"), 1, "lower lost one");
    assert_eq!(field_of(&json, upper, "shapeCount"), 1, "upper untouched");
}

/// The counts must not break the JSON for consumers — `useEngineCore` parses
/// this string, and an unparseable one empties the whole layer panel (#79).
#[test]
fn the_new_fields_keep_the_json_parseable() {
    let mut t = tool();
    add_a_shape(&mut t);
    add_some_text(&mut t);
    t.add_layer("Second");
    let json = t.get_layers();
    assert!(
        !json.contains("NaN") && !json.contains("Infinity"),
        "{json}"
    );
    assert_eq!(
        json.matches("\"textCount\":").count(),
        json.matches("\"id\":").count(),
        "every layer object must carry textCount"
    );
    assert_eq!(
        json.matches("\"shapeCount\":").count(),
        json.matches("\"id\":").count(),
        "every layer object must carry shapeCount"
    );
}
