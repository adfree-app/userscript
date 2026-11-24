import { describe, expect, test } from 'bun:test'
import { createHarness } from 'userscript-maker/testing'

type Harness = Awaited<ReturnType<typeof createHarness>>

const PAGE = `
  <button id="open-js" type="button">window.open()</button>
  <a id="blank-link" href="https://ads.example.com/offer" target="_blank">new window</a>
  <a id="self-link" href="/local">same tab</a>
  <form id="blank-form" action="https://ads.example.com/subscribe" target="_blank"><button>go</button></form>
`

/** Clicks like a user and returns the event, so `defaultPrevented` can be checked. */
function click(harness: Harness, selector: string, init: MouseEventInit = {}): MouseEvent {
  const element = harness.document.querySelector(selector)!
  const event = new harness.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init
  })
  element.dispatchEvent(event as never)
  return event as unknown as MouseEvent
}

function blockedUrls(harness: Harness): string[] {
  return [...harness.document.querySelectorAll('#usm-popup-blocker .url')].map(node => node.getAttribute('title') ?? '')
}

describe('popup-blocker', () => {
  test('blocks window.open() and reports the URL', async () => {
    const harness = await createHarness(import.meta.dir, { url: 'https://news.example.com/', html: PAGE })
    try {
      harness.run()
      expect(harness.window.open('https://ads.example.com/interstitial', '_blank')).toBeNull()
      expect(blockedUrls(harness)).toEqual(['https://ads.example.com/interstitial'])
    } finally {
      harness.dispose()
    }
  }, 20_000)

  test('blocks target=_blank links but lets a same-tab navigation through', async () => {
    const harness = await createHarness(import.meta.dir, { url: 'https://news.example.com/', html: PAGE })
    try {
      harness.run()
      expect(click(harness, '#blank-link').defaultPrevented).toBe(true)
      expect(blockedUrls(harness)).toEqual(['https://ads.example.com/offer'])
      expect(click(harness, '#self-link').defaultPrevented).toBe(false)
    } finally {
      harness.dispose()
    }
  }, 20_000)

  test('an explicit ctrl/cmd click is the user asking for a tab — allowed', async () => {
    const harness = await createHarness(import.meta.dir, { url: 'https://news.example.com/', html: PAGE })
    try {
      harness.run()
      // our capture handler must not intercept the click; happy-dom then performs the
      // "open a new window" default action through `window.open`, which we do block.
      expect(click(harness, '#blank-link', { ctrlKey: true }).defaultPrevented).toBe(false)
      expect(click(harness, '#blank-link', { metaKey: true }).defaultPrevented).toBe(false)
    } finally {
      harness.dispose()
    }
  }, 20_000)

  test('counts repeated requests of the same URL', async () => {
    const harness = await createHarness(import.meta.dir, { url: 'https://news.example.com/', html: PAGE })
    try {
      harness.run()
      click(harness, '#blank-link')
      click(harness, '#blank-link')
      click(harness, '#blank-link')
      expect(blockedUrls(harness)).toHaveLength(1)
      expect(harness.document.querySelector('#usm-popup-blocker .badge')?.textContent).toBe('×3')
      expect(harness.document.querySelector('#usm-popup-blocker .count')?.textContent).toContain('3 tries')
    } finally {
      harness.dispose()
    }
  }, 20_000)

  test('deny clears one row, "deny all" clears the panel', async () => {
    const harness = await createHarness(import.meta.dir, { url: 'https://news.example.com/', html: PAGE })
    try {
      harness.run()
      click(harness, '#blank-link')
      harness.window.open('https://ads.example.com/interstitial', '_blank')
      expect(blockedUrls(harness)).toHaveLength(2)

      ;(harness.document.querySelector('#usm-popup-blocker .actions .deny') as HTMLButtonElement).click()
      expect(blockedUrls(harness)).toHaveLength(1)

      ;(harness.document.querySelector('#usm-popup-blocker .ghost') as HTMLButtonElement).click()
      expect(blockedUrls(harness)).toHaveLength(0)
      expect((harness.document.getElementById('usm-popup-blocker') as HTMLElement).hidden).toBe(true)
    } finally {
      harness.dispose()
    }
  }, 20_000)

  test('form submissions that target a new window are held back', async () => {
    const harness = await createHarness(import.meta.dir, { url: 'https://news.example.com/', html: PAGE })
    try {
      harness.run()
      const form = harness.document.querySelector('#blank-form')!
      const event = new harness.window.SubmitEvent('submit', { bubbles: true, cancelable: true })
      form.dispatchEvent(event as never)
      expect(event.defaultPrevented).toBe(true)
      expect(blockedUrls(harness)).toEqual(['https://ads.example.com/subscribe'])
    } finally {
      harness.dispose()
    }
  }, 20_000)
})
