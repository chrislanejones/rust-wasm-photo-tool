# Night 6 — Async operations and truthful feedback

Base: Night 5; master rechecked f4dfd6c9.

Verified before modification: useAsyncTask leaves its context current after timeout or completion. Late progress can replace the error with processing, and ZIP packaging can finish and download after a timeout. ZIP reports 100% before packaging and permits repeated submissions while pending. OpenRaster's timeout wording claims work was stopped even though the underlying promise is not cancelled.

End the run's context at settlement, retain owner checks for saved-state expiry, reject late side effects, and report measured packaging progress as its own phase. Preserve dialog primitives/focus and supported retries. Inspect other shared-hook callers before changing them; no extra async state store or backend/auth/billing changes.

Refine now announces actual engine work with StatusMark (motion-safe spin), disables duplicate Apply/Clean Up while working, and holds a failed preview until a supported Retry succeeds. Retry uses the current draft and is scoped to the same document. Leaving the session cancels pending presentation. Apply failures are caught and remain visible; no unhandled rejection or pretend completion.

Validation: all 1,882 Vitest tests, TypeScript, ESLint (0 errors, 54 warnings), guardrails, production build and inert audit pass. Seven production browser cases pass across ZIP, OpenRaster success/failure, injected refinement failure/busy/retry, selection-to-mask and injected full-disk save recovery. Hook tests hold packaging past timeout, verify no download, reject late progress and double submission. Screenshot: test-results/state-v4-night6-error.png.

Performance: no canvas hot-path changes. Progress during packaging comes directly from JSZip; preparation and packaging have distinct labels, without invented weighted overall percentages. Shared async state/primitives and existing dialog focus behavior are retained. Already correct: import skeletons, local/cloud distinction, batch feedback and AI ownership/timeout checks. Limit: OpenRaster has no underlying cancellation API; its timeout explicitly says a pending import may still finish rather than claiming cancellation. Live cloud/AI calls are not exercised by offline regression tests. No Rust or storage changes.
