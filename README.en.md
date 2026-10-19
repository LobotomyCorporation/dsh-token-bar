# dsh-token-bar

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A **per-turn token usage strip** for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI. It lives in each reply's own icon row — the line carrying copy / branch / usage / timestamp — and draws that turn's cache structure as a grey / yellow / green segmented bar, with a written legend that carries each slice's share.

![The per-turn strip: grey = uncached input, yellow = cache read, green = output, followed by a legend with each share](docs/screenshot-turn-bar.png)

**Featherweight**: presentation only — no network, no storage, no host routes, no session-log writes, and no patching of any official package.
**Zero dependencies**: one hand-written bundle that only uses the platform-provided React.

English | [中文](README.md)

---

## Why

The shipped turn-usage popover has the exact numbers, but a list of numbers has to be read while a shape is understood at a glance:

- Was this turn served entirely from cache?
- Did a large uncached prefix appear (a prefix invalidated, cost jumping)?
- Is the output share abnormal?

`dsh-token-bar` turns those three figures into a scannable strip with a legend — **you know what each slice is and how big it is without hovering**.

## What it looks like

| | |
|---|---|
| Slice / legend order | **grey (uncached input) → yellow (cache read) → green (output)** — the strip and the legend share one order |
| Strip width | 132px |
| Minimum slice | **6px** for any non-zero bucket, so a 0.1% share still shows and keeps matching the legend |
| Legend | dot + name + this turn's share |
| Type size | one notch below body copy: `calc(var(--dsh-content-font-size-secondary, 13px) - 1px)`, so it tracks the shell font setting |
| Colours | the `--dsw-*` theme tokens only, so light and dark follow the shell |
| Alignment | vertically centred on the icon row |

Hovering shows the full breakdown: cache hit rate plus every bucket's exact token count and share.

> Cache write is not a slice: this route reports 0 for it.

## Where the numbers come from

It reads `tokenUsage` from this Turn's `turn-tail` location data — **this turn's** accounting, the same value the shipped "turn usage" popover prints, never the session-wide projection.

The `conversation.chat.assistant-actions` slot hands over only a **message id**, so the component resolves the Turn back through `useChat`: every completed Turn publishes a `turn-tail` entry carrying both its closing `messageId` and its own `tokenUsage`, so matching the id recovers this turn's accounting. `useChat` ships on the session standard kit (`SessionStandardProps` in `dsh-client-ui-chat`'s `slots.d.ts`), so nothing extra has to be injected.

Credit to [dsh-token-counter](https://github.com/OkliaoliO/dsh-token-counter) for the implementation reference.

## Install

```sh
dsh plugin --profile web add dsh-token-bar
```

From a local directory (development):

```sh
dsh plugin --profile web add /path/to/dsh-token-bar
```

Restart `dsh web` afterwards. Uninstall with `dsh plugin --profile web remove dsh-token-bar`.

## Compatibility

| Component | Supported |
|---|---|
| DSH | `>=0.2.0-rc.1 <0.3.0-0`, verified on `0.2.0-rc.2` |
| Node.js | `>=20` |
| UI | DSH Web (needs the `conversation.chat.assistant-actions` slot) |
| OS | macOS / Linux / Windows (pure JavaScript) |

## Development

```sh
npm run check   # syntax
npm test        # pure helpers + render
```

`npm test` verifies the **source** `client.js` by default. To verify the build the browser actually receives, snapshot it from a running `dsh web`:

```sh
node scripts/snapshot-bundle.mjs "http://127.0.0.1:3080/?token=<token printed at startup>"
npm test        # with verify-module.js present, tests the served bundle instead
```

## Tunables

All at the top of `client.js`: `BUCKETS` (slices, order, colours), `MIN_SEGMENT_PX` (default `6`), `TRACK_PX` (default `132`), `FONT_SIZE`.

## Known limits

- Completed (`turn/end`) turns only; the turn currently streaming has no strip.
- **It follows the icon row's reveal rule**: only the latest reply keeps that row visible, so older replies show the strip on hover, like the row itself.
- **Position is bounded by the official layout**: that row is hard-coded as copy → plugin actions → branch → usage → timestamp, and the only plugin slot sits between copy and branch. The strip therefore lands to the left of the usage pill rather than between usage and timestamp — there is no slot there.
- It relies on the official `turn-tail` location-data shape; a change there needs a matching update here.
- There is no settings UI — restyle by editing the source.

## License

MIT
