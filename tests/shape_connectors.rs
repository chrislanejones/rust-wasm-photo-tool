//! Connectors: `reroute_connector` moves an arrow's endpoints with NO history
//! step of its own, so it rides the snapshot of the box edit that caused it —
//! one Ctrl+Z puts the box and every connector attached to it back together.
//!
//! It also breaks the op log (the box edit plus N re-routed arrows would be
//! N+1 reconciled ops under one snapshot), which is pinned by the op-log test
//! at the bottom: undo must restore BOTH shapes, not rewind one arrow.
use stamp_tool::ImageHorseTool;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(200, 120);
    t.load_image(&vec![10u8; 200 * 120 * 4]);
    t
}

fn add(t: &mut ImageHorseTool, kind: u8, x0: f64, y0: f64, x1: f64, y1: f64) -> u32 {
    t.add_shape_annotation(
        kind, x0, y0, x1, y1, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    )
}

/// `(x0, y0, x1, y1)` of shape `id`, read back out of the JSON.
fn geom(t: &ImageHorseTool, id: u32) -> (f64, f64, f64, f64) {
    let json = t.get_shape_annotations();
    let at = json
        .find(&format!("{{\"id\":{id},"))
        .expect("shape is listed");
    let rest = &json[at..];
    let num = |key: &str| -> f64 {
        let i = rest.find(&format!("\"{key}\":")).unwrap() + key.len() + 3;
        let s = &rest[i..];
        let end = s.find([',', '}']).unwrap();
        s[..end].parse().unwrap()
    };
    (num("x0"), num("y0"), num("x1"), num("y1"))
}

/// A box at (10,10)-(50,50) wired from its east port to a box at
/// (120,10)-(160,50)'s west port.
fn wired(t: &mut ImageHorseTool) -> (u32, u32) {
    let a = add(t, 0, 10.0, 10.0, 50.0, 50.0);
    add(t, 0, 120.0, 10.0, 160.0, 50.0);
    let arrow = add(t, 4, 50.0, 30.0, 120.0, 30.0);
    (a, arrow)
}

/// Move box `a` 20px down, then re-route the arrow's start with it — what
/// the JS commit does.
fn move_and_reroute(t: &mut ImageHorseTool, a: u32, arrow: u32) {
    assert!(t.update_shape_annotation(
        a, 0, 10.0, 30.0, 50.0, 70.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    ));
    assert!(t.reroute_connector(arrow, 50.0, 50.0, 120.0, 30.0));
}

#[test]
fn reroute_moves_the_arrow_ends() {
    let mut t = tool();
    let (a, arrow) = wired(&mut t);
    move_and_reroute(&mut t, a, arrow);
    assert_eq!(geom(&t, arrow), (50.0, 50.0, 120.0, 30.0));
}

#[test]
fn reroute_refuses_anything_but_an_arrow() {
    let mut t = tool();
    let (a, _) = wired(&mut t);
    assert!(!t.reroute_connector(a, 0.0, 0.0, 1.0, 1.0));
    assert_eq!(geom(&t, a), (10.0, 10.0, 50.0, 50.0));
    assert!(!t.reroute_connector(9999, 0.0, 0.0, 1.0, 1.0));
}

#[test]
fn one_undo_puts_the_box_and_its_connector_back() {
    let mut t = tool();
    let (a, arrow) = wired(&mut t);
    move_and_reroute(&mut t, a, arrow);
    t.undo();
    assert_eq!(geom(&t, a), (10.0, 10.0, 50.0, 50.0));
    assert_eq!(geom(&t, arrow), (50.0, 30.0, 120.0, 30.0));
}

#[test]
fn op_log_undo_puts_the_box_and_its_connector_back() {
    let mut t = tool();
    t.set_oplog_undo(true);
    let (a, arrow) = wired(&mut t);
    t.recomposite();
    move_and_reroute(&mut t, a, arrow);
    t.recomposite();
    t.undo();
    assert_eq!(geom(&t, a), (10.0, 10.0, 50.0, 50.0));
    assert_eq!(geom(&t, arrow), (50.0, 30.0, 120.0, 30.0));
}
