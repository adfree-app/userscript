import { describe, expect, test } from 'bun:test'
import type { CatalogScript } from './catalog'
import {
  detailPath,
  formatDate,
  formatSize,
  installUrl,
  matchSummary,
  permissionSummary,
  sortScripts
} from './catalog'

function script(overrides: Partial<CatalogScript> = {}): CatalogScript {
  return {
    slug: 'popup-blocker',
    name: 'Popup Blocker',
    version: '1.0.0',
    match: ['*://*/*'],
    include: [],
    grant: ['unsafeWindow'],
    size: 10_536,
    gzip: 3_230,
    ...overrides
  }
}

describe('catalog helpers', () => {
  test('a script with no url is served from the store folder', () => {
    expect(installUrl(script(), 'https://adfree-app.github.io/userscript/')).toBe(
      'https://adfree-app.github.io/userscript/userscripts/popup-blocker.user.js'
    )
    expect(installUrl(script(), 'http://localhost:4173/')).toBe(
      'http://localhost:4173/userscripts/popup-blocker.user.js'
    )
  })

  test('a url in the catalog wins over the folder', () => {
    const entry = script({ url: 'https://cdn.example/x.user.js' })
    expect(installUrl(entry, 'https://adfree-app.github.io/userscript/')).toBe(
      'https://cdn.example/x.user.js'
    )
  })

  test('sizes read the way a store page prints them', () => {
    expect(formatSize(0)).toBe('—')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(10_536)).toBe('10.3 kB')
    expect(formatSize(120_000)).toBe('117 kB')
    expect(formatSize(2_500_000)).toBe('2.4 MB')
  })

  test('dates are day/month/year in UTC', () => {
    expect(formatDate('2026-11-24T19:06:35.337Z')).toBe('24/11/2026')
    expect(formatDate('not a date')).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  test('hosts collapse to the ones a reader recognises', () => {
    expect(matchSummary(script())).toBe('every site')
    expect(matchSummary(script({ match: ['https://www.youtube.com/*'] }))).toBe('youtube.com')
    expect(
      matchSummary(
        script({ match: ['https://a.com/*', 'https://b.com/*', 'https://c.com/*', 'https://d.com/*'] })
      )
    ).toBe('a.com, b.com, c.com +1')
    // the same host twice is one entry
    expect(matchSummary(script({ match: ['https://a.com/x', 'https://a.com/y'] }))).toBe('a.com')
  })

  test('permissions are deduplicated and sorted, with "none" dropped', () => {
    expect(permissionSummary(script({ grant: ['unsafeWindow', 'GM_addStyle', 'unsafeWindow'] }))).toEqual([
      'GM_addStyle',
      'unsafeWindow'
    ])
    expect(permissionSummary(script({ grant: ['none'] }))).toEqual([])
  })

  test('listing is alphabetical and does not mutate the input', () => {
    const input = [script({ slug: 'b', name: 'Beta' }), script({ slug: 'a', name: 'Alpha' })]
    expect(sortScripts(input).map(entry => entry.slug)).toEqual(['a', 'b'])
    expect(input.map(entry => entry.slug)).toEqual(['b', 'a'])
  })

  test('detail links live under /s/', () => {
    expect(detailPath('popup-blocker')).toBe('/s/popup-blocker')
  })
})
