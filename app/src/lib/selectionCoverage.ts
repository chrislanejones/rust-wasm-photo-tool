// "Selected 18.4% · 2.1 MP" — how much the selection covers.
//
// The number exists to answer a question the overlay cannot: did that click
// do anything? A wand click that takes 0.02% of the image is a miss, and with
// only marching ants to go on it looks like nothing happened. So small values
// keep their digits instead of rounding to a reassuring "0.0%", and a tiny
// selection is counted in pixels rather than as "0.0 MP".
//
// The count comes from the engine (`selection_coverage`, one pass over the
// selection plane). This file only formats it.

/** Pixels selected and pixels in the document, from one engine read. */
export interface SelectionCoverage {
  selected: number;
  total: number;
}

/** Decode the engine's `[selected, total]` answer. `null` for anything that
 *  is not a two-number answer, or for an empty selection — the readout is
 *  absent when nothing is selected, never "0%". */
export function toCoverage(raw: ArrayLike<number> | null | undefined): SelectionCoverage | null {
  if (!raw || raw.length < 2) return null;
  const selected = Number(raw[0]);
  const total = Number(raw[1]);
  if (!(selected > 0) || !(total > 0)) return null;
  return { selected, total };
}

/** The percentage, with as many decimals as it takes to not lie: one above 1%,
 *  two below it, and "<0.01" for a selection that exists but rounds away. */
export function formatPercent({ selected, total }: SelectionCoverage): string {
  if (selected >= total) return "100";
  const pct = (selected / total) * 100;
  if (pct >= 99.95) return "99.9"; // not selected-everything, so never "100"
  if (pct >= 1) return pct.toFixed(1);
  if (pct >= 0.01) return pct.toFixed(2);
  return "<0.01";
}

/** Megapixels from 0.1 MP up; below that, the pixel count itself. */
export function formatArea(selected: number): string {
  if (selected >= 100_000) return `${(selected / 1_000_000).toFixed(1)} MP`;
  return `${selected.toLocaleString("en-US")} px`;
}

/** The whole readout: "Selected 18.4% · 2.1 MP". */
export function describeCoverage(c: SelectionCoverage): string {
  return `Selected ${formatPercent(c)}% · ${formatArea(c.selected)}`;
}
