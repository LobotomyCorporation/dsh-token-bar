/**
 * Host half of dsh-token-bar.
 *
 * Purely presentational: every number the browser half shows is already in
 * the Client (the `tokenUsage` projection and the per-turn `tokenUsage` node
 * data), so this half registers nothing and holds no state. The row exists
 * only because a profile bundle is mounted through its patch entry.
 *
 * @module dsh-token-bar
 */

export const name = 'token-bar'

/** No host services are needed; the Client half is declared in package.json. */
export const inject = []

/** @param {import('@deepseek-ai/cordis').Context} _ctx - host context (unused). */
export function apply(_ctx) {}
