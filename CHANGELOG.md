# Changelog

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
