//! `duplicate_text_annotation` / `duplicate_shape_annotation` — the engine
//! primitive behind Review → Reselect's Duplicate button.
//!
//! WHY THE ENGINE AND NOT JS. `get_text_annotations()` already emits all 34
//! fields, so a JS-side duplicate could read one and call
//! `add_text_annotation` with them. That works exactly until someone adds a
//! 35th field: the getter gains it, the JS re-add does not pass it, and every
//! duplicate silently loses that property with nothing failing. Cloning the
//! struct cannot drift that way, and `field_completeness_survives_a_clone`
//! below is the test that says so in a form that keeps holding.
use stamp_tool::ImageHorseTool;

const W: u32 = 200;
const H: u32 = 200;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![10u8; (W * H * 4) as usize]);
    t
}

/// A text annotation with every "interesting" field set to a NON-default
/// value — a background, a tail, a shadow, a rotation, bold. A duplicate that
/// rebuilt from a subset of fields would drop one of these.
fn text_with_everything(t: &mut ImageHorseTool) -> u32 {
    t.add_text_annotation(
        "hello", 24.0, 200, 100, 50,   // text, size, rgb
        true, // bold
        30, 40,   // x, y
        15.0, // rotation
        1,    // background_kind: solid rect
        9, 8, 7, 240, // bg rgba
        6,   // bg_padding
        4,   // bg_corner_radius
        1,   // bg_tail
    )
}

#[test]
fn duplicating_text_offsets_the_copy_and_leaves_the_original() {
    let mut t = tool();
    let src = text_with_everything(&mut t);

    let copy = t.duplicate_text_annotation(src, 12, -7);
    assert!(copy > 0, "duplicate returned a sentinel, not an id");
    assert_ne!(copy as u32, src, "the copy must not reuse the source id");
    assert_eq!(t.text_annotation_count(), 2, "original must survive");

    let json = t.get_text_annotations();
    let orig = field(&json, src, "x");
    let dup = field(&json, copy as u32, "x");
    assert_eq!(orig, 30.0, "source must not move");
    assert_eq!(dup, 42.0, "copy is offset by dx");
    assert_eq!(field(&json, copy as u32, "y"), 33.0, "copy is offset by dy");
}

/// THE point of doing this in Rust. Every field of the source is compared
/// against the copy; only `id`, `x` and `y` are allowed to differ. A future
/// field added to `TextAnnotation` is covered the moment it reaches the JSON,
/// with no edit to this test — which is exactly what a hand-listed field
/// comparison would NOT give.
#[test]
fn field_completeness_survives_a_clone() {
    let mut t = tool();
    let src = text_with_everything(&mut t);
    let copy = t.duplicate_text_annotation(src, 0, 0) as u32;

    let json = t.get_text_annotations();
    let a = object_for(&json, src);
    let b = object_for(&json, copy);

    let pairs_a = key_values(&a);
    let pairs_b = key_values(&b);
    assert_eq!(
        pairs_a.len(),
        pairs_b.len(),
        "copy has a different field count than the source"
    );
    assert!(pairs_a.len() > 20, "sanity: the JSON should be field-rich");

    for (k, va) in &pairs_a {
        let vb = pairs_b
            .iter()
            .find(|(kb, _)| kb == k)
            .map(|(_, v)| v.clone())
            .unwrap_or_else(|| panic!("copy is missing field {k}"));
        if k == "id" {
            continue; // must differ — asserted above
        }
        assert_eq!(va, &vb, "field {k} was not carried to the duplicate");
    }
}

#[test]
fn duplicating_text_is_one_undo_step_and_undo_removes_the_copy() {
    let mut t = tool();
    let src = text_with_everything(&mut t);
    let before = t.undo_count();

    t.duplicate_text_annotation(src, 5, 5);
    assert_eq!(
        t.undo_count(),
        before + 1,
        "a duplicate must push exactly ONE history entry"
    );

    t.undo();
    assert_eq!(
        t.text_annotation_count(),
        1,
        "undo must leave only the original"
    );
}

#[test]
fn duplicating_a_missing_text_id_is_a_pure_no_op() {
    let mut t = tool();
    text_with_everything(&mut t);
    let before = t.undo_count();

    assert_eq!(
        t.duplicate_text_annotation(9999, 4, 4),
        -1,
        "unknown id must return the -1 sentinel"
    );
    assert_eq!(t.text_annotation_count(), 1, "nothing may be added");
    assert_eq!(
        t.undo_count(),
        before,
        "a no-op must not push a history entry"
    );
}

#[test]
fn duplicating_a_shape_offsets_it_and_stacks_it_on_top() {
    let mut t = tool();
    let src = t.add_shape_annotation(
        0, 20.0, 20.0, 100.0, 100.0, "#ff0000", 2.0, 0, 0, "#00ff00", "#0000ff", 0, 0,
    );

    let copy = t.duplicate_shape_annotation(src, 10.0, 10.0);
    assert!(copy > 0);
    assert_ne!(copy as u32, src);
    assert_eq!(t.shape_annotation_count(), 2);

    // Appended, so the copy is last in the Vec — which IS the draw order
    // (render_layer iterates it bottom-to-top), so the copy sits on top.
    let json = t.get_shape_annotations();
    let last_id = last_object_id(&json);
    assert_eq!(last_id, copy as u32, "the duplicate must be drawn on top");
}

#[test]
fn duplicating_a_missing_shape_id_is_a_pure_no_op() {
    let mut t = tool();
    t.add_shape_annotation(
        0, 20.0, 20.0, 100.0, 100.0, "#ff0000", 2.0, 0, 0, "#00ff00", "#0000ff", 0, 0,
    );
    let before = t.undo_count();
    assert_eq!(t.duplicate_shape_annotation(4242, 1.0, 1.0), -1);
    assert_eq!(t.shape_annotation_count(), 1);
    assert_eq!(t.undo_count(), before);
}

// ── tiny JSON helpers ────────────────────────────────────────────────────
// The engine emits JSON by hand (annotations_to_json), so these read it back
// by hand too rather than pulling serde into the test profile.

/// The `{...}` object whose `"id":<id>` matches, without its braces.
fn object_for(json: &str, id: u32) -> String {
    for raw in json.trim_matches(['[', ']']).split("},{") {
        let body = raw.trim_matches(['{', '}']);
        if key_values(body)
            .iter()
            .any(|(k, v)| k == "id" && v == &id.to_string())
        {
            return body.to_string();
        }
    }
    panic!("no annotation with id {id} in {json}");
}

/// Flat key/value pairs. Splits on commas that are not inside a nested
/// bracket or a quoted string — `perspective` is an array and `text` is a
/// string that may contain a comma.
fn key_values(body: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut depth = 0i32;
    let mut in_str = false;
    let mut cur = String::new();
    let mut prev = '\0';
    for c in body.chars() {
        match c {
            '"' if prev != '\\' => {
                in_str = !in_str;
                cur.push(c);
            }
            '[' | '{' if !in_str => {
                depth += 1;
                cur.push(c);
            }
            ']' | '}' if !in_str => {
                depth -= 1;
                cur.push(c);
            }
            ',' if !in_str && depth == 0 => {
                push_pair(&mut out, &cur);
                cur.clear();
            }
            _ => cur.push(c),
        }
        prev = c;
    }
    push_pair(&mut out, &cur);
    out
}

fn push_pair(out: &mut Vec<(String, String)>, chunk: &str) {
    let chunk = chunk.trim();
    if chunk.is_empty() {
        return;
    }
    if let Some((k, v)) = chunk.split_once(':') {
        out.push((
            k.trim().trim_matches('"').to_string(),
            v.trim().trim_matches('"').to_string(),
        ));
    }
}

fn field(json: &str, id: u32, key: &str) -> f64 {
    let body = object_for(json, id);
    key_values(&body)
        .into_iter()
        .find(|(k, _)| k == key)
        .unwrap_or_else(|| panic!("no field {key}"))
        .1
        .parse()
        .expect("numeric field")
}

fn last_object_id(json: &str) -> u32 {
    let body = json
        .trim_matches(['[', ']'])
        .split("},{")
        .last()
        .expect("at least one object")
        .trim_matches(['{', '}'])
        .to_string();
    key_values(&body)
        .into_iter()
        .find(|(k, _)| k == "id")
        .expect("id field")
        .1
        .parse()
        .expect("numeric id")
}
