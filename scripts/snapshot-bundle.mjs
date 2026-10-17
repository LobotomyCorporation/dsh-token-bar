// Extract this plugin's module out of a running DSH Web server's plugin bundle
// and save it as verify-module.js, so `npm test` can verify the build the
// browser actually receives rather than only the source tree.
//
// Usage:
//   node scripts/snapshot-bundle.mjs "http://127.0.0.1:3080/?token=..."
//
// The token is the one `dsh web` prints on startup. Without it the plugin
// bundle route answers 401/404 and this script exits non-zero.
import { writeFileSync } from 'node:fs'

const origin = process.argv[2]
if (origin === undefined) {
  console.error('usage: node scripts/snapshot-bundle.mjs "http://127.0.0.1:<port>/?token=<token>"')
  process.exit(2)
}

const base = new URL(origin)
const html = await (await fetch(base, { redirect: 'follow' })).text()

// The page preloads one combined "plugins/??<id>/client.js,...&rev=..." URL.
// This plugin is the first entry, so anchor on its id and take that href.
const hrefMatch = html.match(/href="(plugins\/\?\?dsh-token-bar\/client\.js[^"]*)"/)
if (hrefMatch === null) {
  console.error('could not find the dsh-token-bar entry in the plugin bundle list')
  process.exit(1)
}

const bundleUrl = new URL(hrefMatch[1].replaceAll('&amp;', '&'), base)
const combined = await (await fetch(bundleUrl)).text()

const start = combined.indexOf('window.__ModuleLoader__.load({')
if (start < 0) {
  console.error('the plugin bundle contains no module for dsh-token-bar')
  process.exit(1)
}
const next = combined.indexOf('window.__ModuleLoader__.load({', start + 10)
const moduleSource = next > 0 ? combined.slice(start, next) : combined.slice(start)

if (!moduleSource.includes("id: 'dsh-token-bar'")) {
  console.error('the first module in the bundle is not dsh-token-bar; adjust the extraction anchor')
  process.exit(1)
}

const target = new URL('../verify-module.js', import.meta.url)
writeFileSync(target, moduleSource)
console.log(`wrote ${moduleSource.length} chars to verify-module.js`)
