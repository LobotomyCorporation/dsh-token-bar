# Changelog

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
