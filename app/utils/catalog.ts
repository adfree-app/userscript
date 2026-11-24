/**
 * The catalog `usm catalog` writes into `public/userscripts/catalog.json`, and
 * the handful of derivations the store page needs. Kept free of Nuxt so it can
 * be unit tested.
 */

export interface CatalogScript {
  slug: string
  name: string
  namespace?: string
  version: string
  description?: string
  author?: string
  license?: string
  homepage?: string
  source?: string
  match: string[]
  include: string[]
  exclude?: string[]
  runAt?: string
  grant: string[]
  connect?: string[]
  size: number
  gzip: number
  hash?: string
  url?: string
  builtAt?: string
}

export interface Catalog {
  manifestVersion: number
  generatedAt: string
  scripts: CatalogScript[]
}

/** Where the store keeps the built files, relative to the app's base URL. */
export const CATALOG_PATH = 'userscripts/catalog.json'

/** A script's own page, for the app's router. */
export function detailPath(slug: string): string {
  return `/s/${slug}`
}

/** `<base>/userscripts/<slug>.user.js` — what a manager has to fetch. */
export function installUrl(script: CatalogScript, baseUrl = ''): string {
  if (script.url) return script.url
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/userscripts/${script.slug}.user.js`
}

/** Human-readable size, in the units a store page shows. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1000) return `${kb.toFixed(kb < 100 ? 1 : 0)} kB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/** `2026-11-24T19:06:35.337Z` → `24/11/2026`, without pulling in a date library. */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`
}

/**
 * The hosts a script runs on, collapsed for the card: three named hosts, or
 * "every site" when the match pattern covers all of them.
 */
export function matchSummary(script: CatalogScript, limit = 3): string {
  if (script.match.length === 1 && script.match[0] === '*://*/*') return 'every site'
  const hosts = script.match.map((pattern) => {
    const host = pattern.replace(/^[a-z*]+:\/\//, '').replace(/[/?].*$/, '')
    // `www.` and the wildcard label are noise on a card
    return host.replace(/^(?:\*\.|www\.)/, '')
  })
  const unique = [...new Set(hosts)]
  if (unique.length <= limit) return unique.join(', ')
  return `${unique.slice(0, limit).join(', ')} +${unique.length - limit}`
}

/** What a script asks the manager for, in the order a reader cares about. */
export function permissionSummary(script: CatalogScript): string[] {
  return [...new Set(script.grant.filter(grant => grant !== 'none'))].sort()
}

export function sortScripts(scripts: CatalogScript[]): CatalogScript[] {
  return [...scripts].sort((a, b) => a.name.localeCompare(b.name))
}
