// Page-at-a-time navigation. Built for the Trail Log's 17 pages of releases
// (15 per page) and reusable anywhere a list is paged.
//
// Also controlled: it renders the window of page numbers and calls onPage. It
// returns null at pageCount <= 1, so a one-page list simply has no pager.
import "./preview.css";
import { useState } from "react";
import { Pager as PagerCmp } from "photo-horse-marketing";

/* Mid-range, which is the only place both ellipses appear: first page, a gap,
   the pages around the current one, a gap, the last page. */
export function Middle() {
  const [page, setPage] = useState(6);
  return <PagerCmp page={page} pageCount={17} onPage={setPage} />;
}

/* The first page — Previous is disabled, and the left gap is gone because
   pages 1-2 are already adjacent. */
export function FirstPage() {
  const [page, setPage] = useState(1);
  return <PagerCmp page={page} pageCount={17} onPage={setPage} />;
}

/* Few enough pages that the whole range fits and neither gap appears. */
export function NoGaps() {
  const [page, setPage] = useState(2);
  return <PagerCmp page={page} pageCount={4} onPage={setPage} label="Posts" />;
}
