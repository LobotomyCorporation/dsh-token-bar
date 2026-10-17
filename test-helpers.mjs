// Pure-function self-test for the client half's formatting helpers.
// The helper block is plain JS inside the loader factory, so evaluate the
// source text between its markers instead of importing the bundle.
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
const bucketsAt = source.indexOf('    const BUCKETS = [')
const start = source.indexOf('    /** Format a token count')
const end = source.indexOf('    return {\n      inject:')
if (bucketsAt < 0 || start < 0 || end < 0) throw new Error('helper block not found')

const helpers = new Function(
  `${source.slice(bucketsAt, end)}\nreturn { BUCKETS, MIN_SEGMENT_PX, TRACK_PX, formatTokens, cacheHit, segmentsOf, percentLabel, titleOf }`,
)()

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
  console.log('ok  ' + message)
}

assert(helpers.formatTokens(42794) === '42.8K', 'formatTokens(42794) = 42.8K')
assert(helpers.formatTokens(6516427) === '6.5M', 'formatTokens(6516427) = 6.5M')

// Legend order IS strip order: grey (uncached) -> yellow (cache read) -> green (output).
assert(helpers.BUCKETS[0].key === 'uncachedInputTokens', 'strip starts with uncached input (grey)')
assert(helpers.BUCKETS[1].key === 'cacheReadTokens', 'strip keeps cache read in the middle (yellow)')
assert(helpers.BUCKETS[2].key === 'outputTokens', 'strip ends with output (green)')
assert(helpers.BUCKETS[0].label === '未缓存输入' && helpers.BUCKETS[1].label === '缓存读取' && helpers.BUCKETS[2].label === '输出', 'legend labels follow the same order')

// A heavily cached Turn (your screenshot) must still show every slice.
const usage = { uncachedInputTokens: 16710, cacheReadTokens: 6492288, cacheWriteTokens: 0, outputTokens: 7429 }
const segments = helpers.segmentsOf(usage)
assert(segments.length === 3, 'all three non-zero buckets survive')
assert(
  segments.every((segment) => segment.px >= helpers.MIN_SEGMENT_PX),
  `every slice keeps at least ${helpers.MIN_SEGMENT_PX}px`,
)
assert(
  Math.abs(segments.reduce((sum, segment) => sum + segment.px, 0) - helpers.TRACK_PX) < 1e-9,
  'slice widths fill the track exactly',
)
assert(segments[1].px > segments[0].px && segments[1].px > segments[2].px, 'cache read stays dominant')
assert(helpers.percentLabel(segments[1]) === '99.6%', 'percentage label is one decimal')
assert(helpers.percentLabel(segments[0]) === '0.3%', 'tiny share still reads its true percentage')

// A zero bucket is not drawn at all, so it is not in the legend either.
const oneSided = helpers.segmentsOf({ uncachedInputTokens: 0, cacheReadTokens: 100, cacheWriteTokens: 0, outputTokens: 50 })
assert(oneSided.length === 2 && oneSided[0].key === 'cacheReadTokens', 'a zero bucket never renders')

assert(helpers.cacheHit({ uncachedInputTokens: 221, cacheReadTokens: 41728, cacheWriteTokens: 0, outputTokens: 845 }) === '99.5', 'cacheHit = reads / prompt side')
assert(helpers.cacheHit({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 9, outputTokens: 9 }) === '0', 'a cache write with no read is a 0% hit')

const title = helpers.titleOf('本轮用量', usage, segments)
assert(title.startsWith('本轮用量\n缓存命中 99.7%'), 'tooltip names the Turn, then the hit share')
assert(title.includes('缓存读取 6.5M · 99.6%'), 'tooltip carries exact figure and percentage')

console.log('\nall token-bar helper assertions passed')
