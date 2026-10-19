/**
 * Client half of dsh-token-bar.
 *
 * One seat: `conversation.chat.assistant-actions` (a `list` slot) renders into
 * the reply's own icon row — the line that carries copy / branch / usage /
 * timestamp. The strip therefore sits inline with that metadata instead of on
 * a separate line under the reply.
 *
 * GRAIN — the strip reads THIS TURN, not the session. This slot hands over only
 * the durable `messageId`, so the Turn is resolved backwards through `useChat`:
 * the session standard kit provides that selector on every session-scoped seat,
 * and a Turn publishes its `turn-tail` location data carrying both the closing
 * message id and this Turn's `tokenUsage` — the same figure the shipped
 * "本轮用量" popover prints. The session-wide `tokenUsage` projection is
 * deliberately NOT used; mixing the two grains beside each other misreads.
 *
 * SEGMENT ORDER follows the legend dots that trail the strip:
 * grey (uncached input) → yellow (cache read) → green (output). The strip is
 * wide enough that the smallest slice stays visible.
 *
 * Hand-written bundle: the module loader materializes `factory(require)` and
 * takes its return value as the exports; React comes from the browser module
 * table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-token-bar',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Style element id; a hot reload must not stack duplicate sheets. */
    const STYLE_ID = 'dsh-token-bar-style'
    /** Diagnostics label. */
    const NS = 'dsh-token-bar'

    /**
     * Buckets in STRIP AND LEGEND order — grey (uncached input) on the left,
     * yellow (cache read) in the middle, green (output) on the right, matching
     * the LobeHub convention. Cache write is omitted: this route reports 0.
     */
    const BUCKETS = [
      {
        key: 'uncachedInputTokens',
        label: '未缓存输入',
        color: 'var(--dsw-static-neutral-bluish-500)',
      },
      {
        key: 'cacheReadTokens',
        label: '缓存读取',
        color: 'var(--dsw-alias-state-warn-primary, var(--dsw-static-amber-500))',
      },
      {
        key: 'outputTokens',
        label: '输出',
        color: 'var(--dsw-alias-state-success-primary, var(--dsw-static-green-500))',
      },
    ]

    /**
     * Smallest rendered slice, in px. A highly cached Turn is 99.6% yellow, so
     * a literal share would shrink the other two to sub-pixel slivers and the
     * strip would stop matching its own legend. Every non-zero bucket keeps at
     * least this much width; the remainder is shared by the real proportions.
     */
    const MIN_SEGMENT_PX = 6
    /** Strip width in px; wider now that two legend rows sit beside it. */
    const TRACK_PX = 132

    /**
     * The legend is deliberately one notch BELOW body copy: it is metadata,
     * and `font-size: inherit` picked up the tail row's larger type and
     * outranked the reply text. Derived from the shell's content scale so it
     * still tracks the user's font setting; the secondary scale (the shipped
     * pill's own basis) minus another point is the floor.
     */
    const FONT_SIZE =
      'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)'

    const CSS = `
.dsh-tb-root{box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;align-self:center;flex:none;font-family:inherit;font-size:${FONT_SIZE};font-weight:400;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dsh-tb-track{box-sizing:border-box;display:inline-flex;gap:1px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,var(--dsw-static-neutral-bluish-100));flex:none;align-items:stretch;height:5px;width:${TRACK_PX}px}
.dsh-tb-seg{display:block;height:100%;flex:none;min-width:${MIN_SEGMENT_PX}px;transition:width .18s ease}
.dsh-tb-seg:first-child{border-top-left-radius:999px;border-bottom-left-radius:999px}
.dsh-tb-seg:last-child{border-top-right-radius:999px;border-bottom-right-radius:999px}
.dsh-tb-legend{display:inline-flex;align-items:center;gap:9px;flex:none;white-space:nowrap}
.dsh-tb-item{display:inline-flex;align-items:center;gap:4px;flex:none}
.dsh-tb-dot{display:inline-block;flex:none;width:5px;height:5px;border-radius:50%}
.dsh-tb-name{color:var(--dsw-alias-label-tertiary)}
.dsh-tb-pct{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
@media (hover:hover){
/* The official row fades in on hover for every reply except the last
   (TurnTailNodeView sets data-actions-reveal="hover" unless the Turn ends with
   the final response). With the strip living in that row, a hover-only row
   would hide the very numbers the plugin exists to show, so keep the row
   visible. Scoped by the row's own data-clock="end", which only the assistant
   tail carries; the user bubble's row is untouched. */
[data-actions-reveal=hover] [data-clock=end]{opacity:1!important}
}
@media (prefers-reduced-motion:reduce){.dsh-tb-seg{transition:none}}
`

    /**
     * A usable count from one usage field: missing, non-numeric, NaN, Infinity
     * and negative values all count as zero, so arithmetic below never turns a
     * malformed payload into a broken strip or a "NaN%" label.
     */
    function num(value) {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }

    /** Format a token count the way the shipped pill does: 812 / 12.3K / 716.5K / 1.2M. */
    function formatTokens(value) {
      const n = num(value)
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
      if (n >= 1e3) {
        const kilo = (n / 1e3).toFixed(1)
        // 999_950 would otherwise print "1000.0K"; roll it into the next unit.
        return kilo === '1000.0' ? '1.0M' : `${kilo}K`
      }
      return n >= 999.5 ? '1.0K' : String(Math.round(n))
    }

    /** Cache hit share of prompt-side input, one decimal, trailing `.0` dropped. */
    function cacheHit(usage) {
      const prompt = num(usage?.uncachedInputTokens) + num(usage?.cacheReadTokens) + num(usage?.cacheWriteTokens)
      if (prompt <= 0) return null
      const pct = (num(usage?.cacheReadTokens) / prompt) * 100
      const text = pct >= 99.95 ? '100' : pct.toFixed(1)
      return text.endsWith('.0') ? text.slice(0, -2) : text
    }

    /**
     * Non-empty buckets with the px width they occupy in the strip.
     *
     * A bucket with any tokens always draws at least MIN_SEGMENT_PX, so a
     * 99.6%-cached Turn still shows a visible grey sliver and a visible green
     * sliver — the strip keeps matching the legend. The rest of the track is
     * split by the real proportions, so the dominant slice stays dominant.
     */
    function segmentsOf(usage) {
      const counts = BUCKETS.map((bucket) => num(usage?.[bucket.key]))
      const total = counts.reduce((sum, count) => sum + count, 0)
      if (total <= 0) return null
      const present = BUCKETS.map((bucket, slot) => ({
        ...bucket,
        tokens: counts[slot],
        weight: counts[slot] / total,
      })).filter((segment) => segment.tokens > 0)

      const reserved = present.length * MIN_SEGMENT_PX
      const remainder = Math.max(0, TRACK_PX - reserved)
      return present.map((segment) => ({
        ...segment,
        px: MIN_SEGMENT_PX + segment.weight * remainder,
      }))
    }

    /** One-decimal percentage label, e.g. "99.6%". */
    function percentLabel(segment) {
      return `${(segment.weight * 100).toFixed(1)}%`
    }

    /** Hover text naming every bucket and its share. */
    function titleOf(name, usage, segments) {
      const hit = cacheHit(usage)
      const lines = segments.map(
        (segment) => `${segment.label} ${formatTokens(segment.tokens)} · ${percentLabel(segment)}`,
      )
      if (hit !== null) lines.unshift(`缓存命中 ${hit}%`)
      return `${name}\n${lines.join('\n')}`
    }

    /**
     * Segmented strip plus a written legend: one dot, the bucket name, and its
     * share of this Turn — all in the same left-to-right order as the strip.
     * @param {object} props
     * @param {Array} props.segments - non-empty bucket list, in strip order.
     * @param {string} props.title - hover text.
     */
    function TokenBar({ segments, title }) {
      const label = title.replace(/\n/g, '，')
      return h(
        'span',
        // One accessible name for the whole graphic: the strip and the legend
        // are its visual halves, so they stay out of the accessibility tree and
        // a screen reader reads the hover text once instead of two fragments.
        { className: 'dsh-tb-root', title, role: 'img', 'aria-label': label },
        h(
          'span',
          { className: 'dsh-tb-track', 'aria-hidden': 'true' },
          segments.map((segment) =>
            h('span', {
              key: segment.key,
              className: 'dsh-tb-seg',
              style: { width: `${segment.px}px`, background: segment.color },
            }),
          ),
        ),
        h(
          'span',
          { className: 'dsh-tb-legend', 'aria-hidden': 'true' },
          segments.map((segment) =>
            h(
              'span',
              { key: segment.key, className: 'dsh-tb-item' },
              h('span', { className: 'dsh-tb-dot', style: { background: segment.color } }),
              h('span', { className: 'dsh-tb-name' }, segment.label),
              h('span', { className: 'dsh-tb-pct' }, percentLabel(segment)),
            ),
          ),
        ),
      )
    }

    /**
     * Per-snapshot index: closing message id → that Turn's accounting.
     *
     * A completed Turn publishes a `turn-tail` location-data entry holding both
     * `closing.finalNode.messageId` and its own `tokenUsage`, so matching the id
     * recovers the same per-Turn figure the shipped popover prints.
     *
     * Built ONCE per snapshot rather than scanned per reply: every mounted seat
     * re-runs its selector on every store update (one per streamed chunk), so N
     * visible replies scanning a list of T Turns would cost O(N·T) each time.
     * The WeakMap is keyed on the snapshot itself, so the index dies with it.
     */
    const USAGE_INDEX = new WeakMap()

    function usageIndex(snapshot) {
      // Also keeps a non-object snapshot out of the WeakMap below.
      if (snapshot === null || typeof snapshot !== 'object') return undefined
      const cached = USAGE_INDEX.get(snapshot)
      if (cached !== undefined) return cached
      const index = new Map()
      const turns = snapshot.timeline?.turns
      if (turns !== undefined && turns !== null && typeof turns.values === 'function') {
        for (const turn of turns.values()) {
          const data = typeof turn?.data?.get === 'function' ? turn.data.get('turn-tail') : undefined
          if (data === undefined || data === null) continue
          const messageId = data.closing?.finalNode?.messageId
          if (messageId === undefined || messageId === null) continue
          // First writer wins: the strip must not flicker between Turns that
          // somehow share a closing message.
          if (index.has(messageId)) continue
          index.set(messageId, data.tokenUsage)
        }
      }
      USAGE_INDEX.set(snapshot, index)
      return index
    }

    /**
     * Whether two usages draw the same strip. The selector compares by these
     * four counts instead of by object identity, because the stored
     * `tokenUsage` object is rebuilt on every snapshot and identity would
     * re-render every reply on every streamed chunk.
     */
    function sameUsage(left, right) {
      if (left === right) return true
      if (left === undefined || left === null || right === undefined || right === null) return false
      return (
        num(left.uncachedInputTokens) === num(right.uncachedInputTokens) &&
        num(left.cacheReadTokens) === num(right.cacheReadTokens) &&
        num(left.cacheWriteTokens) === num(right.cacheWriteTokens) &&
        num(left.outputTokens) === num(right.outputTokens)
      )
    }

    /**
     * The strip for one reply.
     *
     * The capability gate lives OUTSIDE the component that calls the hook: a
     * seat that gets no `useChat` renders nothing at all, so the hook call can
     * never appear or disappear between renders of a mounted instance — which
     * would violate the hook order React enforces.
     */
    function TurnBar(props) {
      const useChat = props?.useChat
      const messageId = props?.messageId
      if (typeof useChat !== 'function' || messageId === undefined || messageId === null) {
        return null
      }
      return h(TurnBarSeat, { useChat, messageId })
    }

    /** The seat proper: one unconditional selector over this reply's Turn. */
    function TurnBarSeat({ useChat, messageId }) {
      const usage = useChat((snapshot) => usageIndex(snapshot)?.get(messageId), sameUsage)
      if (usage === undefined || usage === null) return null
      const segments = segmentsOf(usage)
      if (segments === null) return null
      return h(TokenBar, { segments, title: titleOf('本轮用量', usage, segments) })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          if (typeof document === 'undefined' || document.getElementById(STYLE_ID) !== null) return
          const element = document.createElement('style')
          element.id = STYLE_ID
          element.setAttribute('data-plugin', NS)
          element.textContent = CSS
          document.head.appendChild(element)
          return () => element.remove()
        }, 'token-bar: styles')

        // The strip rides the reply's own icon row. This seat hands over only
        // the durable `messageId`; TurnBar resolves that back to the Turn's
        // accounting through the session kit's `useChat` (see usageIndex).
        // order 95 keeps it to the right of dsh-mnemon's save action (90),
        // i.e. as close to the shipped usage pill as a supported slot allows.
        ctx.slots.inject('conversation.chat.assistant-actions', () =>
          ctx.slots.register(
            {
              name: 'conversation.chat.assistant-actions',
              id: 'token-bar-turn',
              order: 95,
            },
            TurnBar,
          ),
        )
      },
    }
  },
})
