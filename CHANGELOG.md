# Changelog

## 0.2.4

Released 2026-11-19; one fix, honestly told.

0.2.3 restyled the grey bucket on the claim that the 0.2.2-rc.1 theme cut the
static bluish ramp at 300 and retired bluish-500. That claim was wrong: the
rc.1 palette ships the full 00–1000 ramp and DSH itself still paints
ghost-button active borders with bluish-500. The old grey never died — the
alias swap washed it from rgb(151,157,166) down to rgb(225,229,238) in light
mode, and the eye caught it in a day.

- **The grey is back to its 0.2.2 colour.** The uncached-input bucket is
  `var(--dsw-static-neutral-bluish-500)` again, no alias layer. None of the
  label aliases carry that depth (they are text tiers: 200/300/400/1000 in
  light mode), so the direct ramp reference is deliberate — a comment in
  client.js records the reasoning.
- **Track fallback restored to bluish-100.** The 0.2.3 "dead reference"
  cleanup rested on the same false premise; bluish-100 is alive
  (bg-document-preview uses it). The primary alias was never dead either, so
  this line was unrendered either way.
- **The two-layer regression guard is gone.** Requiring every bucket colour
  to be `alias, static` enforced the wrong lesson; test-helpers now asserts
  every colour resolves from a `--dsw-*` token, and pins the grey's
  deliberate static step.

Everything else from 0.2.3 — turn-wide strip indexing, the manifest cleanup,
the README rewrite — stands unchanged.

## 0.2.3

Released 2026-11-19; compatibility with the restructured static palette shipped by
DSH 0.2.2-rc.1, plus turn-wide strip indexing.

- **The grey segment is visible again.** The uncached-input bucket painted
  itself with `--dsw-static-neutral-bluish-500`, which the 0.2.2-rc.1 theme
  no longer defines (the static bluish ramp now stops at 300). With no
  fallback the background resolved to transparent, and on a low-cache turn
  the largest slice of the strip silently disappeared. The grey bucket now
  uses the same two-layer shape as yellow and green: alias first, static
  fallback — `var(--dsw-alias-label-dimmed, var(--dsw-static-neutral-bluish-300))`.
- **No dead fallback references left.** The track background's fallback
  pointed at `--dsw-static-neutral-bluish-100`, which is also gone from the
  current theme; it now falls back to `--dsw-static-neutral-bluish-300`, so
  a future alias rename can never hand the track a transparent colour.
- **Steered turns keep their strip on every reply.** The strip used to be
  indexed only under the message that closed the turn, so a reply interrupted
  by a mid-turn steering message silently lost it. The index now also walks
  the conversation's assistant nodes, so every reply of a completed turn —
  before or after a steering message — carries that turn's usage. Aborted
  turns whose closing message was assembled from stream chunks (no durable
  message id) still render without a strip.
- **Regression guard.** `test-helpers.mjs` now asserts every bucket colour
  is a two-layer `var()`, so a bare token reference cannot slip in again.
- **Removed the dead `dshReleases` manifest field.** No DSH version ever
  read `dsh.compatibility.dshReleases`; the tested-release table in the
  README remains the source of truth.

## 0.2.2

**Published to npm** on 2026-10-20: `npm i dsh-token-bar`, or
`dsh plugin --profile web add dsh-token-bar`.

Review pass: no visible change, but the strip now costs nothing per streamed token
and cannot be bent by a malformed payload.

- **One scan per snapshot, not one per reply.** Each seat re-runs its selector on
  every store update, and the Turn list was being scanned per reply — O(replies ×
  turns) per streamed chunk. The Turn list is now indexed once per snapshot in a
  `WeakMap` keyed on the snapshot itself, so the index dies with the snapshot.
- **No re-render when the figures did not change.** The selector passes an
  equality function comparing the four counts, because the stored `tokenUsage`
  object is rebuilt on every snapshot and identity comparison alone would
  re-render every visible reply on every chunk.
- **Hook order is now unconditional.** The capability gate moved into an outer
  component that renders no hooks, so the selector can never appear or vanish on
  a mounted instance.
- **Malformed payloads cannot draw a broken strip.** Missing, non-numeric, `NaN`,
  infinite and negative counts all read as zero; a payload with nothing usable
  renders nothing rather than `NaN%`.
- **Token units roll over.** 999,950 tokens read as `1.0M`, not `1000.0K`.
- **One accessible name.** The strip carries `role="img"` plus the hover text as
  its label, and both visual halves are `aria-hidden`, so a screen reader reads
  the accounting once instead of two fragments.
- Removed the no-op `inject: () => ({})` from the registration (its result is
  already merged with nothing).

## 0.2.1

The icon row now stays visible on assistant replies.

- The official row fades in on hover for every reply except the last
  (`TurnTailNodeView` sets `data-actions-reveal="hover"` unless the Turn ends
  with the final response, and `MessageIconActions`' stylesheet zeroes the row's
  opacity under `@media (hover:hover)`).
- With the strip living in that row, the numbers would otherwise be unreachable
  without hovering — so `[data-actions-reveal=hover] [data-clock=end]` is pinned
  to `opacity: 1`. The selector rides the row's own `data-clock="end"`, which only
  the assistant tail carries, so the user bubble's row keeps the official
  behaviour.
- Side effect, by design: copy / branch / usage / timestamp are permanently
  visible under every reply, not only the newest one.

## 0.2.0

The strip moves off its own line and into the reply's icon row.

- **Seat**: `conversation.chat.assistant-actions` (order 95) replaces
  `conversation.chat.turnTail` (order -10). The strip now renders inline in the
  copy / branch / usage / timestamp row instead of on a separate line below the
  reply.
- **Data path**: that slot hands over only `messageId`, so the Turn is resolved
  backwards through `useChat` — every completed Turn publishes a `turn-tail`
  entry carrying both its closing `messageId` and its own `tokenUsage`.
- **Styling**: `align-self: center` on the icon row; the own-line auto margins
  are gone.
- `scripts/snapshot-bundle.mjs` no longer assumes this plugin is the first
  module in the combined bundle (it is not, once a profile holds several
  plugins), and it accepts `--html <saved-page.html>` because the startup token
  is single-use.

### Why not between the usage pill and the timestamp

`MessageIconActions` hard-codes its children as clock(start) / copy /
`extraActions` / branch / `span.endInfo{[usageAction, clockEl]}`. The usage pill
and the timestamp are two siblings INSIDE `endInfo`, and no slot reaches inside
it — `assistant-actions` is the only seat in that row. Putting the strip between
them would need DOM surgery against a build-hashed class name, so it was
declined. The strip therefore sits to the left of the usage pill.

Consequence worth knowing: the icon row fades in on hover for every reply except
the latest, and the strip now follows that rule too (it used to be always
visible on its own line).

## 0.1.0

First public release.

- Per-turn token strip on `conversation.chat.turnTail`, reading
  `turn.data.get('turn-tail').tokenUsage` (the same figure the shipped turn
  usage popover prints).
- Slice and legend order: grey (uncached input) → yellow (cache read) → green
  (output).
- Written legend: dot + name + this turn's percentage.
- 6px minimum slice so a small share still renders and keeps matching the
  legend; 132px track.
- Theme-token colours, shell font scale minus one point, left-anchored.
- Hover breakdown with cache hit rate and each bucket's exact tokens.

### Notes on the path here

- An earlier iteration placed a session-cumulative strip in the composer dock.
  That grain was wrong — the shipped pill already shows the session figure — so
  it was removed.
- A session-cumulative bar and a boxed percentage chip were also tried in the
  composer dock and dropped as visual noise next to the shipped pill.
- Cache write was a fourth slice at first; it is always 0 on this route, so it
  was folded away.
- The "turn usage" popover is portaled straight to `document.body` without a
  slot, so this plugin deliberately does not touch it; a DOM-observing hack
  would break on any upstream refactor.
