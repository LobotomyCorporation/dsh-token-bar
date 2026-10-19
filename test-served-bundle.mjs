// Offline verification of the SERVED client bundle: run the module through
// the same loader handshake the browser uses, with a small React stub (the
// browser module table provides the real one), then render both seats with a
// fake projection hook and assert the segmented markup.
import { readFileSync } from 'node:fs'

// -- React stub: createElement produces plain trees we can walk -------------
function element(type, props, ...children) {
  return { $$el: true, type, key: props?.key ?? null, props: { ...props, children } }
}
const React = {
  createElement: element,
  useMemo(fn) {
    return fn()
  },
  useCallback(fn) {
    return fn
  },
  useState(init) {
    const v = [typeof init === 'function' ? init() : init]
    return [v[0], (x) => void (v[0] = x)]
  },
  useEffect() {},
}

const requireStub = (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected module ${id}`)
}

// -- Module loader stub ------------------------------------------------------
let loaded = null
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      loaded = { id, exports: factory(requireStub) }
    },
  },
}

// Prefer the snapshot the running `dsh web` actually served (extract it with
// scripts/snapshot-bundle.mjs); fall back to the source bundle so a fresh
// clone can run `npm test` with nothing else set up.
const servedSnapshot = new URL('./verify-module.js', import.meta.url)
const sourceBundle = new URL('./client.js', import.meta.url)
let bundlePath = sourceBundle
try {
  readFileSync(servedSnapshot)
  bundlePath = servedSnapshot
  console.log('note  testing the SERVED bundle snapshot (verify-module.js)')
} catch {
  console.log('note  no served snapshot; testing client.js directly')
}

const source = readFileSync(bundlePath, 'utf8')
new Function(source)()
if (loaded === null) throw new Error('bundle did not call __ModuleLoader__.load')

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
  console.log('ok  ' + message)
}

assert(loaded.id === 'dsh-token-bar', 'bundle loads under the expected id')
assert(typeof loaded.exports.apply === 'function', 'exports an apply()')
assert(Array.isArray(loaded.exports.inject) && loaded.exports.inject.includes('slots'), 'declares the slots injection')

// -- Slot registry double ----------------------------------------------------
const registrations = []
const appended = []
globalThis.document = {
  getElementById: () => null,
  createElement: (tag) => ({ tag, setAttribute() {}, remove() {} }),
  head: { appendChild: (el) => appended.push(el) },
}
const ctx = {
  effect(fn) {
    return fn()
  },
  slots: {
    inject(key, run) {
      run()
      return () => {}
    },
    register(options, Component) {
      registrations.push({ options, Component })
      return () => {}
    },
  },
}

loaded.exports.apply(ctx)
assert(appended.length === 1 && appended[0].tag === 'style', 'injects exactly one stylesheet')
assert(registrations.length === 1, 'registers exactly one seat')

const [bar] = registrations
assert(bar.options.name === 'conversation.chat.assistant-actions', 'the bar rides the reply icon row')
assert(
  registrations.every((entry) => entry.options.name !== 'conversation.composer.dock'),
  'the input box keeps the shipped pill alone',
)
assert(
  registrations.every((entry) => entry.options.name !== 'conversation.chat.turnTail'),
  'the strip no longer takes a line of its own under the reply',
)

// -- Render the seat from the owner props (messageId) + the session kit ------
// The seat hands over only the durable message id, so the Turn is resolved
// backwards through `useChat`: a Turn publishes `turn-tail` location data
// carrying both the closing message id and its own tokenUsage.
const turnUsage = {
  uncachedInputTokens: 16710,
  cacheReadTokens: 6492288,
  cacheWriteTokens: 0,
  outputTokens: 7429,
  totalTokens: 6516427,
}
const otherUsage = {
  uncachedInputTokens: 1,
  cacheReadTokens: 2,
  cacheWriteTokens: 0,
  outputTokens: 3,
  totalTokens: 6,
}
const turnOf = (messageId, usage) => ({
  data: {
    get: (key) =>
      key === 'turn-tail' ? { closing: { finalNode: { messageId } }, tokenUsage: usage } : undefined,
  },
})
// A Turn the strip must NOT read comes first, so a sloppy scan would show up.
const snapshot = {
  timeline: {
    turns: new Map([
      [1, turnOf('msg-other', otherUsage)],
      [2, { data: { get: () => undefined } }],
      [3, turnOf('msg-1', turnUsage)],
    ]),
  },
}
const useChat = (selector) => selector(snapshot)
const messageProps = { messageId: 'msg-1', useChat }

/**
 * Render the seat the way React would: the registered component may be a thin
 * gate that defers to an inner component, so resolve function layers until a
 * host element (or null) appears.
 */
function renderSeat(props) {
  let node = bar.Component(props)
  while (node !== null && typeof node === 'object' && node.$$el && typeof node.type === 'function') {
    node = node.type(node.props)
  }
  return node
}

const tree = renderSeat(messageProps)

/** Collect every element with a className containing `fragment`. */
function findAll(node, fragment, out = []) {
  if (node === null || typeof node !== 'object') return out
  if (!node.$$el) return out
  if (typeof node.type === 'function') {
    const rendered = node.type(node.props)
    if (Array.isArray(rendered)) for (const item of rendered) findAll(item, fragment, out)
    else findAll(rendered, fragment, out)
    return out
  }
  const cls = node.props?.className
  if (typeof cls === 'string' && cls.includes(fragment)) out.push(node)
  for (const child of node.props?.children ?? []) {
    if (Array.isArray(child)) for (const item of child) findAll(item, fragment, out)
    else findAll(child, fragment, out)
  }
  return out
}

const tracks = findAll(tree, 'dsh-tb-track')
assert(tracks.length === 1, 'renders one track')
assert(findAll(tree, 'dsh-tb-session').length === 0, 'the removed session strip never renders')
assert(findAll(tree, 'dsh-tb-label').length === 0, 'no text label sits beside the pill')

const segments = findAll(tree, 'dsh-tb-seg')
assert(segments.length === 3, 'three non-zero buckets render (cacheWrite 0 dropped)')
const widths = segments.map((seg) => Number(seg.props.style.width.replace('px', '')))
assert(
  widths.every((px) => px >= 6),
  `every slice keeps a visible minimum (${widths.map((w) => w.toFixed(1)).join(' / ')}px)`,
)
assert(Math.abs(widths.reduce((a, b) => a + b, 0) - 132) < 0.01, 'slices fill the 132px track')
assert(widths[1] > widths[0] && widths[1] > widths[2], 'cache read stays the dominant middle slice')

// Strip order and legend order both run grey -> yellow -> green.
const dotColours = findAll(tree, 'dsh-tb-dot')
  .filter((dot) => dot.props.className === 'dsh-tb-dot')
  .map((dot) => dot.props.style.background)
assert(dotColours.length === 3, 'three legend dots, one per slice')
assert(String(dotColours[0]).includes('neutral'), 'dot 1 is uncached input (grey, left)')
assert(String(dotColours[1]).includes('warn'), 'dot 2 is cache read (yellow, middle)')
assert(String(dotColours[2]).includes('success'), 'dot 3 is output (green, right)')
assert(
  segments.every((seg, i) => seg.props.style.background === dotColours[i]),
  'each slice is filled with its legend dot colour, in the same order',
)

// The legend is written out: dot + name + this Turn's share.
const names = findAll(tree, 'dsh-tb-name').map((node) => String(node.props.children))
// React props always carry `children` as an array, so normalise before comparing.
const pcts = findAll(tree, 'dsh-tb-pct').map((node) => String(node.props.children))
assert(names.join('|') === '未缓存输入|缓存读取|输出', `legend names follow strip order (${names.join(' / ')})`)
assert(pcts.length === 3, 'every legend entry carries its percentage')
// uncached 16,710 / 6,516,427 = 0.256% -> 0.3%; reads 99.615% -> 99.6%; output 0.114% -> 0.1%
assert(
  pcts[0] === '0.3%' && pcts[1] === '99.6%' && pcts[2] === '0.1%',
  `legend percentages read ${pcts.join(' / ')}`,
)

const root = findAll(tree, 'dsh-tb-root')[0]
const title = String(root.props.title)
assert(title.startsWith('\u672c\u8f6e\u7528\u91cf'), 'hover title names THIS TURN, not the session')
assert(title.includes('\u7f13\u5b58\u547d\u4e2d 99.7%'), 'per-Turn cache hit matches the shipped popover (99.7%)')
assert(
  title.includes('\u7f13\u5b58\u8bfb\u53d6 6.5M'),
  'per-Turn cache read matches the shipped popover (6,492,288)',
)

// The stylesheet must hand the tail row's font down and keep the strip inline.
const css = appended.map((el) => el.textContent).join('\n')
assert(
  /\.dsh-tb-root\{[^}]*font-size:calc\(var\(--dsh-content-font-size-secondary, 13px\) - 1px\)/.test(css),
  'root sits one notch below body copy and still tracks the shell font scale',
)
assert(/\.dsh-tb-root\{[^}]*font-weight:400/.test(css), 'root stays at regular weight, never inheriting a bold row')
assert(/\.dsh-tb-root\{[^}]*font-family:inherit/.test(css), 'root inherits the tail row font family')
assert(/\.dsh-tb-root\{[^}]*display:inline-flex/.test(css), 'root stays inline beside the caption')
assert(/\.dsh-tb-root\{[^}]*flex:none/.test(css), 'root never stretches the caption row')
assert(/\.dsh-tb-track\{[^}]*width:132px/.test(css), 'track is the widened 132px strip')
assert(/\.dsh-tb-seg\{[^}]*min-width:6px/.test(css), 'CSS guarantees the 6px floor as a backstop')
assert(/\.dsh-tb-root\{[^}]*align-self:center/.test(css), 'root centres on the icon row baseline')
assert(/\.dsh-tb-root\{[^}]*flex:none/.test(css), 'root never stretches the icon row')
assert(!/margin-top:auto/.test(css), 'the own-line auto margins are gone now that the row centres it')
assert(!/dsh-tb-(label|session|micro)/.test(css), 'dead CSS for the removed seats is gone')
assert(
  /\[data-actions-reveal=hover\] \[data-clock=end\]\{opacity:1!important\}/.test(css),
  'the assistant icon row stays visible instead of fading in on hover',
)
assert(
  /@media \(hover:hover\)\{[\s\S]*data-actions-reveal/.test(css),
  'that reveal override sits behind the same hover-capable guard as the official rule',
)
assert(
  !/data-chat-flow-kind/.test(css),
  'the override never reaches into the user bubble row',
)

assert(
  renderSeat({ messageId: 'msg-nodata', useChat }) === null,
  'a Turn whose turn-tail data is absent renders nothing',
)
assert(
  renderSeat({ messageId: 'msg-missing', useChat }) === null,
  'a message id outside the loaded Turns renders nothing',
)
assert(
  renderSeat({
    messageId: 'msg-1',
    useChat: () => ({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }),
  }) === null,
  'an all-zero usage renders nothing',
)
assert(renderSeat({ messageId: 'msg-1' }) === null, 'no useChat on the kit renders nothing')
assert(renderSeat({}) === null, 'no owner props at all renders nothing')

// A seat that gets no message id must not reach the hook at all: the gate sits
// above the component that calls it, so the hook can never appear or vanish on
// a mounted instance (which would break React's hook order).
let hookCalls = 0
assert(
  renderSeat({
    useChat: () => {
      hookCalls += 1
      return undefined
    },
  }) === null && hookCalls === 0,
  'a seat with no message id never calls the hook',
)

// -- The selector contract ---------------------------------------------------
let sawEquality
const spyUseChat = (selector, equality) => {
  sawEquality = equality
  return selector(snapshot)
}
renderSeat({ messageId: 'msg-1', useChat: spyUseChat })
assert(
  typeof sawEquality === 'function',
  'the selector passes a custom equality so unchanged figures never re-render',
)
assert(
  sawEquality({ ...turnUsage }, { ...turnUsage }) === true,
  'two usages with identical figures compare equal even as fresh objects',
)
assert(sawEquality(turnUsage, otherUsage) === false, 'different figures compare different')
assert(sawEquality(undefined, undefined) === true, 'two absent usages compare equal')

// -- The per-snapshot index: one scan, not one per reply ---------------------
let scans = 0
const counted = {
  timeline: {
    turns: new Map([
      [
        1,
        {
          data: {
            get: () => {
              scans += 1
              return { closing: { finalNode: { messageId: 'msg-1' } }, tokenUsage: turnUsage }
            },
          },
        },
      ],
    ]),
  },
}
const countedUseChat = (selector) => selector(counted)
renderSeat({ messageId: 'msg-1', useChat: countedUseChat })
const scansAfterFirst = scans
renderSeat({ messageId: 'msg-1', useChat: countedUseChat })
renderSeat({ messageId: 'msg-2', useChat: countedUseChat })
assert(
  scans === scansAfterFirst,
  `the Turn list is indexed once per snapshot, not once per reply (${scans} reads)`,
)

// -- Malformed counts must never produce a broken strip ----------------------
assert(
  renderSeat({
    messageId: 'msg-1',
    useChat: () => ({
      uncachedInputTokens: 'junk',
      cacheReadTokens: null,
      cacheWriteTokens: undefined,
      outputTokens: Number.NaN,
    }),
  }) === null,
  'a payload with no usable counts renders nothing instead of NaN%',
)

const salvage = { uncachedInputTokens: '5', cacheReadTokens: Number.NaN, cacheWriteTokens: undefined, outputTokens: -3 }
const salvageTree = renderSeat({ messageId: 'msg-1', useChat: () => salvage })
const salvageSegments = findAll(salvageTree, 'dsh-tb-seg')
assert(salvageSegments.length === 1, 'junk and negative fields collapse to zero, keeping the one real slice')
assert(
  String(findAll(salvageTree, 'dsh-tb-pct')[0].props.children) === '100.0%',
  'the surviving slice reads as the whole strip',
)

// -- Token formatting rolls into the next unit ------------------------------
const boundary = renderSeat({
  messageId: 'msg-1',
  useChat: () => ({
    uncachedInputTokens: 999950,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }),
})
assert(
  String(findAll(boundary, 'dsh-tb-root')[0].props.title).includes('未缓存输入 1.0M'),
  '999,950 tokens read as 1.0M, never 1000.0K',
)

console.log('\nserved bundle verification passed')
