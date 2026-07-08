# ADR-002: Canvas tools become registry modules instead of hand-wired hooks
Date: 2026-07-02 (backfilled)   Status: draft

## Context
AppShell.tsx (3,300 lines) manually wires ten tool hooks and threads
~18 arguments into a dispatcher (useEffectiveTool). Adding a tool
requires editing the shell in 4+ places; every tool shares the same
implicit context (toolRef, canvasRef, flush/sync, settings).

## Decision
Introduce a ToolModule interface { id, meta, useTool(ctx, active),
SettingsPanel, Overlay? } and a static registry. All modules' hooks
mount in a fixed-order loop so per-tool state survives tool switches.
Sub-modes (brush/erase/mask, stamp variants) live inside modules.

## Consequences
+ Adding tool #11 is one folder, not a shell edit; useEffectiveTool's
  argument pile is deleted.
+ Tool state, settings panel, and overlay co-locate per tool.
- All tool hooks run every render (cheap, but a constraint to know).
- Migration cost: ten tools converted one session each.

## Alternatives rejected
Keyed mount of only the active tool's component — loses cross-switch
state (shapes list, text annotations) that panels depend on.

## Pre-mortem
Six months later this was a mistake most likely because the shared
ToolContext grew into a god-object that every module mutates.
Early warning: a module adding fields to ToolContext that only it uses.
