// Push local commits to GitHub through the REST API.
//
// Why: on this machine `github.com:443` (the git transport) is unreachable
// while `api.github.com:443` is fine, so `git push` times out. The REST git
// data API reaches the same objects, so this replays the local history as
// blobs -> trees -> commits and then points the branch at the NEW remote SHA.
//
// Usage: node scripts/push-via-api.mjs <owner/repo> [--ref main] [--dry-run]
import { execFileSync } from 'node:child_process'

const repo = process.argv[2]
const dryRun = process.argv.includes('--dry-run')
const refIndex = process.argv.indexOf('--ref')
const ref = refIndex > 0 ? process.argv[refIndex + 1] : 'main'

if (repo === undefined || repo.startsWith('--')) {
  console.error('usage: node scripts/push-via-api.mjs <owner/repo> [--ref main] [--dry-run]')
  process.exit(2)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const gitBuffer = (...args) => execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 })

/** POST a JSON body to one REST endpoint and return the parsed response. */
function ghPost(endpoint, body) {
  const out = execFileSync('gh', ['api', '--method', 'POST', endpoint, '--input', '-'], {
    input: JSON.stringify(body),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return out.trim() === '' ? {} : JSON.parse(out)
}

/** PATCH an endpoint; returns the parsed response. */
function ghPatch(endpoint, body) {
  const out = execFileSync('gh', ['api', '--method', 'PATCH', endpoint, '--input', '-'], {
    input: JSON.stringify(body),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return out.trim() === '' ? {} : JSON.parse(out)
}

const headSha = git('rev-parse', 'HEAD').trim()
const order = git('rev-list', '--topo-order', '--reverse', 'HEAD').trim().split('\n')
console.log(`${order.length} local commits, HEAD ${headSha.slice(0, 7)}`)

if (dryRun) {
  console.log('dry run; would replay:', order.map((s) => s.slice(0, 7)).join(' '))
  process.exit(0)
}

// -- Objects ----------------------------------------------------------------
const remoteBlobFor = new Map()
const remoteTreeFor = new Map()
const remoteCommitFor = new Map()
const sent = { blob: 0, tree: 0, commit: 0 }

function pushBlob(sha) {
  const cached = remoteBlobFor.get(sha)
  if (cached !== undefined) return cached
  const content = gitBuffer('cat-file', 'blob', sha)
  const result = ghPost(`repos/${repo}/git/blobs`, {
    content: content.toString('base64'),
    encoding: 'base64',
  })
  remoteBlobFor.set(sha, result.sha)
  sent.blob += 1
  return result.sha
}

function pushTree(sha) {
  const cached = remoteTreeFor.get(sha)
  if (cached !== undefined) return cached
  // `ls-tree` prints "<mode> <type> <sha>\t<path>"; recurse into subtrees so
  // the API receives a nested shape.
  const entries = git('ls-tree', '-z', sha)
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t')
      const [mode, objectType, objectSha] = meta.split(' ')
      return { mode, objectType, objectSha, path }
    })

  const result = ghPost(`repos/${repo}/git/trees`, {
    tree: entries.map(({ objectSha, objectType, path, mode }) => ({
      path,
      mode,
      type: objectType,
      sha: objectType === 'blob' ? pushBlob(objectSha) : pushTree(objectSha),
    })),
  })
  remoteTreeFor.set(sha, result.sha)
  sent.tree += 1
  return result.sha
}

// -- Commits, oldest first ---------------------------------------------------
for (const sha of order) {
  const treeSha = git('show', '-s', '--format=%T', sha).trim()
  const parentLine = git('show', '-s', '--format=%P', sha).trim()
  const parents = parentLine === '' ? [] : parentLine.split(' ')

  const result = ghPost(`repos/${repo}/git/commits`, {
    message: git('show', '-s', '--format=%B', sha),
    tree: pushTree(treeSha),
    parents: parents.map((p) => remoteCommitFor.get(p) ?? p),
    author: {
      name: git('show', '-s', '--format=%an', sha).trim(),
      email: git('show', '-s', '--format=%ae', sha).trim(),
      date: git('show', '-s', '--format=%aI', sha).trim(),
    },
  })
  remoteCommitFor.set(sha, result.sha)
  sent.commit += 1
  console.log(`  ${sha.slice(0, 7)} -> ${result.sha.slice(0, 7)}  ${git('show', '-s', '--format=%s', sha).trim()}`)
}

// -- Branch ------------------------------------------------------------------
const headRemote = remoteCommitFor.get(headSha)
if (headRemote === undefined) {
  console.error('HEAD was not replayed; nothing to point the branch at')
  process.exit(1)
}

let currentTip = null
try {
  currentTip = JSON.parse(
    execFileSync('gh', ['api', `repos/${repo}/git/ref/heads/${ref}`], { encoding: 'utf8' }),
  ).object.sha
} catch {
  // No branch yet.
}

if (currentTip === null) {
  ghPost(`repos/${repo}/git/refs`, { ref: `refs/heads/${ref}`, sha: headRemote })
  console.log(`created ${ref} at ${headRemote.slice(0, 7)}`)
} else if (currentTip === headRemote) {
  console.log(`${ref} already at ${headRemote.slice(0, 7)}`)
} else {
  // A bootstrap commit may sit on the branch from an earlier attempt; this
  // push owns the branch, so move it forcibly.
  ghPatch(`repos/${repo}/git/refs/heads/${ref}`, { sha: headRemote, force: true })
  console.log(`moved ${ref}: ${currentTip.slice(0, 7)} -> ${headRemote.slice(0, 7)}`)
}

ghPatch(`repos/${repo}`, { default_branch: ref })
console.log(`pushed ${sent.commit} commits, ${sent.tree} trees, ${sent.blob} blobs to ${repo}#${ref}`)
