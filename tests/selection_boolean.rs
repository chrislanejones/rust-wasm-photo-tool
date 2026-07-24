//! Boolean selection ops: `selection_union` / `selection_subtract` on the
//! existing `Option<Vec<bool>>` selection. Pure, deterministic, no UI.
//!
//! The selection is read back through `selection_overlay()`: a pixel is
//! selected iff its overlay alpha is non-zero (unselected pixels are
//! `[0,0,0,0]`; an empty/None selection returns an empty overlay).

use stamp_tool::ImageHorseTool;

const W: u32 = 20;
const H: u32 = 12;

/// Filled rectangle mask over `[x0,x1) × [y0,y1)`.
fn rect(x0: u32, y0: u32, x1: u32, y1: u32) -> Vec<bool> {
    let mut m = vec![false; (W * H) as usize];
    for y in y0..y1 {
        for x in x0..x1 {
            m[(y * W + x) as usize] = true;
        }
    }
    m
}

fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![128u8; (W * H * 4) as usize]);
    t
}

/// The current selection, decoded from the overlay's alpha channel.
fn selected(t: &ImageHorseTool) -> Vec<bool> {
    let ov = t.selection_overlay();
    if ov.is_empty() {
        return vec![false; (W * H) as usize];
    }
    (0..(W * H) as usize).map(|i| ov[i * 4 + 3] > 0).collect()
}

/// Seed the tool's selection to exactly `mask` (union onto an empty selection
/// == the mask itself).
fn seed(t: &mut ImageHorseTool, mask: &[bool]) {
    t.clear_selection();
    t.selection_union(&as_u8(mask));
}

fn count(m: &[bool]) -> usize {
    m.iter().filter(|&&b| b).count()
}

/// The exported ops take `&[u8]` (non-zero = set); tests keep their math in
/// bool and convert at the call boundary.
fn as_u8(m: &[bool]) -> Vec<u8> {
    m.iter().map(|&b| b as u8).collect()
}

#[test]
fn union_of_two_overlapping_rects_is_the_combined_mask() {
    let mut t = new_tool();
    let a = rect(2, 2, 10, 8); // 8×6
    let b = rect(6, 4, 14, 10); // overlaps A in [6,10)×[4,8)
    seed(&mut t, &a);
    assert!(t.selection_union(&as_u8(&b)));

    let got = selected(&t);
    let want: Vec<bool> = a.iter().zip(&b).map(|(&x, &y)| x || y).collect();
    assert_eq!(got, want, "union must be exactly A ∪ B");
    // strictly larger than either input (they only partially overlap)
    assert!(count(&got) > count(&a));
    assert!(count(&got) > count(&b));
}

#[test]
fn subtract_removes_exactly_the_overlap_leaving_the_remainder() {
    let mut t = new_tool();
    let a = rect(2, 2, 10, 8);
    let b = rect(6, 4, 14, 10);
    seed(&mut t, &a);
    assert!(t.selection_subtract(&as_u8(&b)));

    let got = selected(&t);
    let want: Vec<bool> = a.iter().zip(&b).map(|(&x, &y)| x && !y).collect();
    assert_eq!(
        got, want,
        "subtract must remove exactly A ∩ B, leaving A \\ B"
    );
    // the removed count equals the overlap size
    let overlap: Vec<bool> = a.iter().zip(&b).map(|(&x, &y)| x && y).collect();
    assert_eq!(count(&got), count(&a) - count(&overlap));
}

#[test]
fn subtracting_a_non_overlapping_region_is_a_no_op() {
    let mut t = new_tool();
    let a = rect(2, 2, 8, 6);
    let far = rect(12, 8, 18, 11); // disjoint from A
    seed(&mut t, &a);
    let before = selected(&t);
    assert!(t.selection_subtract(&as_u8(&far))); // something still selected
    assert_eq!(
        selected(&t),
        before,
        "subtracting a disjoint region changes nothing"
    );
}

#[test]
fn subtracting_everything_yields_no_selection_not_a_zero_area_one() {
    let mut t = new_tool();
    seed(&mut t, &rect(3, 3, 12, 9));
    assert!(t.has_selection());

    let all = vec![true; (W * H) as usize];
    let still = t.selection_subtract(&as_u8(&all));
    assert!(
        !still,
        "nothing should remain selected after subtracting everything"
    );
    assert!(!t.has_selection(), "must read as NO selection");
    assert!(
        t.selection_overlay().is_empty(),
        "overlay must be empty (None), not a zero-area Some(all-false)"
    );
    // and it composes: a downstream op that guards on 'something selected'
    // sees none (delete_selection returns false without mutating).
    assert!(
        !t.delete_selection(),
        "delete_selection must see no selection"
    );
}

#[test]
fn union_onto_an_empty_selection_becomes_the_mask() {
    let mut t = new_tool();
    assert!(!t.has_selection());
    let a = rect(4, 4, 9, 9);
    assert!(t.selection_union(&as_u8(&a)));
    assert_eq!(
        selected(&t),
        a,
        "union with no current selection == the mask"
    );
}

#[test]
fn ops_no_op_safely_on_a_length_mismatch() {
    let mut t = new_tool();
    let a = rect(2, 2, 8, 6);
    seed(&mut t, &a);
    let before = selected(&t);
    let short = vec![1u8; 5]; // wrong length — must not panic or corrupt

    assert!(t.selection_union(&short)); // returns current state (still selected)
    assert!(t.selection_subtract(&short));
    assert_eq!(selected(&t), before, "a mismatched-length mask is ignored");
}
