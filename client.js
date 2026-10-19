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

    /** Format a token count the way the shipped pill does: 812 / 12.3K / 716.5K / 1.2M. */
    function formatTokens(value) {
      const n = Number.isFinite(value) ? Math.max(0, value) : 0
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
      return String(Math.round(n))
    }

    /** Cache hit share of prompt-side input, one decimal, trailing `.0` dropped. */
    function cacheHit(usage) {
      const prompt = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
      if (prompt <= 0) return null
      const pct = (usage.cacheReadTokens / prompt) * 100
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
      const total = BUCKETS.reduce((sum, bucket) => sum + (usage[bucket.key] ?? 0), 0)
      if (total <= 0) return null
      const present = BUCKETS.map((bucket) => ({
        ...bucket,
        tokens: usage[bucket.key] ?? 0,
        weight: (usage[bucket.key] ?? 0) / total,
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
        { className: 'dsh-tb-root', title, 'aria-label': label },
        h(
          'span',
          { className: 'dsh-tb-track', role: 'img', 'aria-hidden': 'true' },
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
     * This Turn's accounting, resolved from the closing assistant's message id.
     *
     * A completed Turn publishes a `turn-tail` location-data entry holding both
     * `closing.finalNode.messageId` and its own `tokenUsage`; matching the id is
     * therefore enough to recover the same per-Turn figure the shipped popover
     * prints. Returns undefined when the Turn is not in the loaded window.
     */
    function turnUsageOf(snapshot, messageId) {
      const turns = snapshot === undefined || snapshot === null ? undefined : snapshot.timeline?.turns
      if (turns === undefined || turns === null) return undefined
      for (const turn of turns.values()) {
        const data = turn === undefined || turn === null || typeof turn.data?.get !== 'function'
          ? undefined
          : turn.data.get('turn-tail')
        if (data === undefined || data === null) continue
        const closing = data.closing
        if (closing === null || closing === undefined) continue
        if (closing.finalNode?.messageId !== messageId) continue
        return data.tokenUsage
      }
      return undefined
    }

    /**
     * The strip for one reply.
     *
     * `useChat` arrives on the session standard kit, so this is a constant
     * capability check rather than state: hook order stays stable across
     * renders. The selector returns the Turn's `tokenUsage` by reference, so a
     * re-render happens only when that figure actually changes.
     */
    function TurnBar(props) {
      const messageId = props?.messageId
      const useChat = props?.useChat
      const usage =
        typeof useChat === 'function' && messageId !== undefined
          ? useChat((snapshot) => turnUsageOf(snapshot, messageId))
          : undefined
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
        // accounting through the session kit's `useChat` (see turnUsageOf).
        // order 95 keeps it to the right of dsh-mnemon's save action (90),
        // i.e. as close to the shipped usage pill as a supported slot allows.
        ctx.slots.inject('conversation.chat.assistant-actions', () =>
          ctx.slots.register(
            {
              name: 'conversation.chat.assistant-actions',
              id: 'token-bar-turn',
              order: 95,
              inject: () => ({}),
            },
            TurnBar,
          ),
        )
      },
    }
  },
})
