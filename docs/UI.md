# UI

Start here for how the editor looks and behaves: the rules, what the UI is
built from, and the work that got it there.

## The rules

| Doc | What it answers |
| --- | --- |
| [UI_CONSISTENCY.md](UI_CONSISTENCY.md) | the ten UI rules, the spacing and type scale, and when a control is a toggle, a switch or a radio group |
| [UI_INVENTORY.md](UI_INVENTORY.md) | what the UI is actually built from, counted |
| [UI_EXCEPTIONS.md](UI_EXCEPTIONS.md) | every place that breaks a rule on purpose, and why |
| [DESIGN.md](../DESIGN.md) | themes, fonts, sizes and the shared components to reuse |
| [PRODUCT.md](../PRODUCT.md) | who it's for, the tone, and the accessibility bar |

Some of these rules are enforced. `./scripts/guardrails.sh` counts spacing
off the scale, raw `<button>`s and exceptions with no reason given, and CI
fails if any count goes up. See [CI.md](CI.md).

The decisions behind them:
[ADR-065](adr/065-the-ui-vocabulary-is-measured-before-it-is-decided.md)
(count the UI before deciding on it) and
[ADR-098](adr/098-ui-code-names-a-history-state-by-engine-node-and-document-revision-not-undo-count.md)
(how UI code names a history state).

## What shipped

| Work | Shipped | What changed |
| --- | --- | --- |
| [UI Nights 9–15](UI_NIGHTS_09_15.md) | v9.27 | gallery, preview loading, and Settings you can use from the keyboard |
| [UI Nights 16–19](UI_NIGHTS_16_19.md) | v9.28 | loading skeletons for sign-in, AI Usage, Compare, Plan & Billing and the phone viewer |
| [Document-state pass](ui-state-v4/08-v927-integration.md) (#348) | v9.29 | photo switching, document controls, Pen and Pins, masks, history and error messages |
| UI Night 20 (#355) | v9.29 | choices, failures and fields a screen reader couldn't hear |

The [seven audit records](ui-state-v4/07-audit.md) behind the document-state
pass are in `ui-state-v4/`. Everything after v9.29 is in the
[Change Summary](Change-summary.md).
