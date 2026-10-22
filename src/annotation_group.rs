//! Several annotations at once (Night 10-22, multi-select): move, align,
//! distribute, delete and duplicate a picked set as ONE undo step.
//!
//! Each call below is one `snap`, so however many objects it touches is one
//! Ctrl+Z on the snapshot path. On the op log every object it changes is an
//! ordinary `ShapeEdit` / `TextEdit` / add / remove (the reconciler diffs
//! them at the next recomposite) and ADR-088's gesture marker groups them,
//! because nothing snaps in between. No format change.
//!
//! Objects are named by two id lists — shapes and texts are two id spaces.
//! Align and distribute also take a GROUP key per object: objects that share
//! one move as a unit and are measured as one box. A Smart Callout's pin,
//! leader and label share a key (lib/callouts.ts finds the join); everything
//! else gets a key of its own.
use crate::annotations::rotation_applies;
use crate::drawing::Rotation;
use crate::ImageHorseTool;
use wasm_bindgen::prelude::*;

/// (min x, min y, max x, max y).
type Box4 = (f64, f64, f64, f64);

fn union(a: Box4, b: Box4) -> Box4 {
    (a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3))
}

/// One group's box and the delta it will move by.
struct Group {
    key: u32,
    bbox: Box4,
    dx: f64,
    dy: f64,
}

impl ImageHorseTool {
    /// A shape's box as it is DRAWN: a rotated rect / diamond / star /
    /// triangle / oval / diagram shape is measured by its rotated corners,
    /// so "align left" lines up what the eye sees.
    fn shape_bbox(&self, id: u32) -> Option<Box4> {
        let s = self.layers[self.active]
            .shape_annotations
            .iter()
            .find(|s| s.id == id)?;
        let (x0, y0, x1, y1) = (s.x0, s.y0, s.x1, s.y1);
        let rot = if rotation_applies(s.kind) {
            Rotation::about_bbox_center(s.rotation_deg, x0, y0, x1, y1)
        } else {
            None
        };
        let Some(r) = rot else {
            return Some((x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1)));
        };
        let mut b = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
        for p in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)] {
            let (x, y) = r.apply(p);
            b = union(b, (x, y, x, y));
        }
        Some(b)
    }

    /// A text's box is its built tile, the same box `align_annotation` uses.
    fn text_bbox(&self, id: u32) -> Option<Box4> {
        let t = self.layers[self.active]
            .text_annotations
            .iter()
            .find(|t| t.id == id)?;
        let x = (t.x + t.tile_offset_x) as f64;
        let y = (t.y + t.tile_offset_y) as f64;
        Some((x, y, x + t.tile_w as f64, y + t.tile_h as f64))
    }

    /// The groups the picked objects form, each with its union box, in the
    /// order their keys first appear. Objects not on the active layer are
    /// skipped. Text deltas are applied rounded (text sits on whole pixels).
    fn groups(
        &self,
        shape_ids: &[u32],
        shape_groups: &[u32],
        text_ids: &[u32],
        text_groups: &[u32],
    ) -> Vec<Group> {
        let mut out: Vec<Group> = Vec::new();
        let picked = shape_ids
            .iter()
            .zip(shape_groups)
            .filter_map(|(&id, &k)| Some((k, self.shape_bbox(id)?)))
            .chain(
                text_ids
                    .iter()
                    .zip(text_groups)
                    .filter_map(|(&id, &k)| Some((k, self.text_bbox(id)?))),
            );
        for (key, b) in picked {
            match out.iter_mut().find(|g| g.key == key) {
                Some(g) => g.bbox = union(g.bbox, b),
                None => out.push(Group {
                    key,
                    bbox: b,
                    dx: 0.0,
                    dy: 0.0,
                }),
            }
        }
        out
    }

    /// Move every picked object by its group's delta. Pushes ONE step (named
    /// `label`) unless nothing moves. Returns whether anything moved.
    fn apply_group_deltas(
        &mut self,
        label: &str,
        groups: &[Group],
        shape_ids: &[u32],
        shape_groups: &[u32],
        text_ids: &[u32],
        text_groups: &[u32],
    ) -> bool {
        if groups.iter().all(|g| g.dx.abs() < 0.5 && g.dy.abs() < 0.5) {
            return false; // already placed — no history churn
        }
        self.snap(label);
        let delta = |k: u32| {
            groups
                .iter()
                .find(|g| g.key == k)
                .map_or((0.0, 0.0), |g| (g.dx, g.dy))
        };
        let layer = &mut self.layers[self.active];
        for (&id, &k) in shape_ids.iter().zip(shape_groups) {
            let (dx, dy) = delta(k);
            if let Some(s) = layer.shape_annotations.iter_mut().find(|s| s.id == id) {
                s.x0 += dx;
                s.y0 += dy;
                s.x1 += dx;
                s.y1 += dy;
                for p in s.points.iter_mut() {
                    p.0 += dx;
                    p.1 += dy;
                }
            }
        }
        for (&id, &k) in text_ids.iter().zip(text_groups) {
            let (dx, dy) = delta(k);
            if let Some(t) = layer.text_annotations.iter_mut().find(|t| t.id == id) {
                t.x += dx.round() as i32;
                t.y += dy.round() as i32;
            }
        }
        true
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Move the picked shapes and texts by `(dx, dy)` together. One "Move"
    /// step; none when nothing on the active layer matches or the delta is
    /// under half a pixel. Returns whether anything moved. Connectors are the
    /// caller's: one with both ends on picked boxes is simply in the list; one
    /// with an end left behind is re-routed with `reroute_connector`, which
    /// rides this step.
    pub fn move_annotations(
        &mut self,
        shape_ids: &[u32],
        text_ids: &[u32],
        dx: f64,
        dy: f64,
    ) -> bool {
        // Every object its own group, all with the same delta.
        let s_keys: Vec<u32> = vec![0; shape_ids.len()];
        let t_keys: Vec<u32> = vec![0; text_ids.len()];
        let mut groups = self.groups(shape_ids, &s_keys, text_ids, &t_keys);
        if groups.is_empty() {
            return false;
        }
        for g in groups.iter_mut() {
            g.dx = dx;
            g.dy = dy;
        }
        self.apply_group_deltas("Move", &groups, shape_ids, &s_keys, text_ids, &t_keys)
    }

    /// Align the picked groups to the SELECTION's bounds (the union of every
    /// group's box): `edge` ∈ {left, centerH, right, top, middleV, bottom}.
    /// One "Align" step. Returns false, pushing nothing, for an unknown edge,
    /// fewer than two groups, or when everything is already aligned.
    pub fn align_annotations(
        &mut self,
        shape_ids: &[u32],
        shape_groups: &[u32],
        text_ids: &[u32],
        text_groups: &[u32],
        edge: &str,
    ) -> bool {
        let mut groups = self.groups(shape_ids, shape_groups, text_ids, text_groups);
        if groups.len() < 2 {
            return false;
        }
        let sel = groups
            .iter()
            .map(|g| g.bbox)
            .fold((f64::MAX, f64::MAX, f64::MIN, f64::MIN), union);
        for g in groups.iter_mut() {
            let (x0, y0, x1, y1) = g.bbox;
            (g.dx, g.dy) = match edge {
                "left" => (sel.0 - x0, 0.0),
                "centerH" => ((sel.0 + sel.2) / 2.0 - (x0 + x1) / 2.0, 0.0),
                "right" => (sel.2 - x1, 0.0),
                "top" => (0.0, sel.1 - y0),
                "middleV" => (0.0, (sel.1 + sel.3) / 2.0 - (y0 + y1) / 2.0),
                "bottom" => (0.0, sel.3 - y1),
                _ => return false,
            };
        }
        self.apply_group_deltas(
            "Align",
            &groups,
            shape_ids,
            shape_groups,
            text_ids,
            text_groups,
        )
    }

    /// Space three or more groups with EQUAL GAPS between their boxes (not
    /// equal centers) along `axis` ∈ {"h", "v"}. The first and last group, by
    /// their leading edge, stay where they are. One "Distribute" step; none
    /// below three groups, for an unknown axis, or when already spaced.
    pub fn distribute_annotations(
        &mut self,
        shape_ids: &[u32],
        shape_groups: &[u32],
        text_ids: &[u32],
        text_groups: &[u32],
        axis: &str,
    ) -> bool {
        let horizontal = match axis {
            "h" => true,
            "v" => false,
            _ => return false,
        };
        let mut groups = self.groups(shape_ids, shape_groups, text_ids, text_groups);
        if groups.len() < 3 {
            return false;
        }
        let span = |b: &Box4| if horizontal { (b.0, b.2) } else { (b.1, b.3) };
        // Leading edge, then trailing edge: a tie keeps a stable order. An
        // insertion sort by hand — a picked set is a handful, and `sort_by`
        // monomorphizes ~7 KB of stable-sort machinery into the binary.
        for i in 1..groups.len() {
            let mut j = i;
            while j > 0 && span(&groups[j].bbox) < span(&groups[j - 1].bbox) {
                groups.swap(j, j - 1);
                j -= 1;
            }
        }
        let n = groups.len();
        let start = span(&groups[0].bbox).0;
        let end = groups
            .iter()
            .map(|g| span(&g.bbox).1)
            .fold(f64::MIN, f64::max);
        let sizes: f64 = groups
            .iter()
            .map(|g| {
                let (a, b) = span(&g.bbox);
                b - a
            })
            .sum();
        let gap = (end - start - sizes) / (n - 1) as f64;
        let mut at = start;
        for g in groups.iter_mut() {
            let (a, b) = span(&g.bbox);
            let d = at - a;
            if horizontal {
                g.dx = d;
            } else {
                g.dy = d;
            }
            at += (b - a) + gap;
        }
        self.apply_group_deltas(
            "Distribute",
            &groups,
            shape_ids,
            shape_groups,
            text_ids,
            text_groups,
        )
    }

    /// Delete the picked shapes and texts. Pins left behind close up once, in
    /// order — deleting pins 2, 3 and 4 of five leaves 1 and 2 — exactly what
    /// one `remove_pin_annotation` per pin would do. One "Delete" step.
    /// Returns how many objects went.
    pub fn remove_annotations(&mut self, shape_ids: &[u32], text_ids: &[u32]) -> u32 {
        let layer = &self.layers[self.active];
        let n = layer
            .shape_annotations
            .iter()
            .filter(|s| shape_ids.contains(&s.id))
            .count()
            + layer
                .text_annotations
                .iter()
                .filter(|t| text_ids.contains(&t.id))
                .count();
        if n == 0 {
            return 0;
        }
        self.snap("Delete");
        let layer = &mut self.layers[self.active];
        let gone: Vec<u32> = layer
            .shape_annotations
            .iter()
            .filter(|s| s.kind == 5 && shape_ids.contains(&s.id))
            .map(|s| s.number)
            .collect();
        layer
            .shape_annotations
            .retain(|s| !shape_ids.contains(&s.id));
        layer.text_annotations.retain(|t| !text_ids.contains(&t.id));
        for s in layer.shape_annotations.iter_mut().filter(|s| s.kind == 5) {
            let below = gone.iter().filter(|&&g| g < s.number).count() as u32;
            s.number -= below;
        }
        if self
            .editing_shape_id
            .is_some_and(|id| shape_ids.contains(&id))
        {
            self.editing_shape_id = None;
        }
        if self
            .editing_text_id
            .is_some_and(|id| text_ids.contains(&id))
        {
            self.editing_text_id = None;
        }
        n as u32
    }

    /// Copy the picked shapes and texts, offset together by `(dx, dy)`, on top
    /// of the draw order. A copied pin is numbered after the last pin, copies
    /// in the order of the originals' numbers, so the sequence stays unique.
    /// One "Duplicate" step. Returns the new shape ids, then the new text ids,
    /// in the order given; an id that matched nothing is skipped.
    pub fn duplicate_annotations(
        &mut self,
        shape_ids: &[u32],
        text_ids: &[u32],
        dx: f64,
        dy: f64,
    ) -> Vec<u32> {
        let layer = &self.layers[self.active];
        let mut shapes: Vec<_> = shape_ids
            .iter()
            .filter_map(|&id| layer.shape_annotations.iter().find(|s| s.id == id).cloned())
            .collect();
        let mut texts: Vec<_> = text_ids
            .iter()
            .filter_map(|&id| layer.text_annotations.iter().find(|t| t.id == id).cloned())
            .collect();
        if shapes.is_empty() && texts.is_empty() {
            return Vec::new();
        }
        // Pin copies take max+1, max+2… by the originals' numbers: a copy's
        // offset is its rank among the copied pins by (number, list order).
        // Quadratic, like `renumber_pins`, and for the same reason: a handful
        // of pins, and cheaper in the binary than a sort.
        let last_pin = layer
            .shape_annotations
            .iter()
            .filter(|s| s.kind == 5)
            .map(|s| s.number)
            .max()
            .unwrap_or(0);
        let key = |i: usize| (shapes[i].number, i);
        let ranks: Vec<(usize, u32)> = (0..shapes.len())
            .filter(|&i| shapes[i].kind == 5)
            .map(|i| {
                let below = (0..shapes.len())
                    .filter(|&j| shapes[j].kind == 5 && key(j) < key(i))
                    .count() as u32;
                (i, last_pin + 1 + below)
            })
            .collect();
        for (i, n) in ranks {
            shapes[i].number = n;
        }
        self.snap("Duplicate");
        let mut ids = Vec::with_capacity(shapes.len() + texts.len());
        for s in shapes.iter_mut() {
            s.id = self.next_shape_id;
            self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
            s.x0 += dx;
            s.y0 += dy;
            s.x1 += dx;
            s.y1 += dy;
            for p in s.points.iter_mut() {
                p.0 += dx;
                p.1 += dy;
            }
            ids.push(s.id);
        }
        for t in texts.iter_mut() {
            t.id = self.next_text_id;
            self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
            t.x += dx.round() as i32;
            t.y += dy.round() as i32;
            ids.push(t.id);
        }
        let layer = &mut self.layers[self.active];
        layer.shape_annotations.extend(shapes);
        layer.text_annotations.extend(texts);
        self.recomposite();
        ids
    }
}
