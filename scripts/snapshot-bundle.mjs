// Extract this plugin's module out of a running DSH Web server's plugin bundle
// and save it as verify-module.js, so `npm test` can verify the build the
// browser actually receives rather than only the source tree.
//
// Usage:
//   node scripts/snapshot-bundle.mjs "http://127.0.0.1:3080/?token=..."
//   node scripts/snapshot-bundle.mjs "http://127.0.0.1:3080/" --html page.html
//
// The startup token is single-use, so a second run against the same server
// answers 401. Pass the page you already saved with --html in that case; the
// bundle URL itself needs no token.
import { readFileSync, writeFileSync } from 'node:fs'

const [origin, ...flags] = process.argv.slice(2)
if (origin === undefined) {
  console.error('usage: node scripts/snapshot-bundle.mjs "http://127.0.0.1:<port>/?token=<token>" [--html <saved-page.html>]')
  process.exit(2)
}
const htmlFlag = flags.indexOf('--html')

const base = new URL(origin)
const html =
  htmlFlag >= 0
    ? readFileSync(flags[htmlFlag + 1], 'utf8')
    : await (await fetch(base, { redirect: 'follow' })).text()

// The page preloads one or more combined "plugins/??<id>/client.js,...&rev=..."
// URLs. This plugin may sit anywhere in one of them (and is NOT necessarily the
// first module), so pick the href that lists it and then locate its module.
const MARKER = 'window.__ModuleLoader__.load({'
const hrefs = [...html.matchAll(/href="(plugins\/\?\?[^"]*)"/g)].map((match) => match[1])
const href = hrefs.find((candidate) => candidate.includes('dsh-token-bar/client.js'))
if (href === undefined) {
  console.error(`could not find the dsh-token-bar entry in ${hrefs.length} plugin bundle list(s)`)
  process.exit(1)
}

const bundleUrl = new URL(href.replaceAll('&amp;', '&'), base)
const combined = await (await fetch(bundleUrl)).text()

// Every module in the bundle starts at a loader call; take the chunk that
// declares this plugin's id, whatever its position.
let moduleSource = null
for (let at = combined.indexOf(MARKER); at >= 0; at = combined.indexOf(MARKER, at + 1)) {
  const next = combined.indexOf(MARKER, at + MARKER.length)
  const chunk = combined.slice(at, next < 0 ? combined.length : next)
  if (chunk.includes("id: 'dsh-token-bar'") || chunk.includes('id: "dsh-token-bar"')) {
    moduleSource = chunk
    break
  }
}
if (moduleSource === null) {
  console.error('the plugin bundle contains no module for dsh-token-bar')
  process.exit(1)
}

const target = new URL('../verify-module.js', import.meta.url)
writeFileSync(target, moduleSource)
console.log(`wrote ${moduleSource.length} chars to verify-module.js`)
