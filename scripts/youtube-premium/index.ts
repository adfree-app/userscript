import { defineMeta } from 'userscript-maker'
import 'userscript-maker/gm'
import { getResource } from 'userscript-maker/resources'

defineMeta({
  name: 'YouTube Premium (client side)',
  description:
    'Client-side premium-ish YouTube: strips video/feed ads from the player response, keeps audio playing in background tabs, unlocks the best quality and hides Premium upsells.',
  license: 'MIT',
  match: ['https://www.youtube.com/*', 'https://m.youtube.com/*', 'https://music.youtube.com/*'],
  grant: ['unsafeWindow', 'GM.getValue', 'GM.setValue', 'GM.registerMenuCommand'],
  runAt: 'document-start',
  noframes: true
})

interface Settings {
  background: boolean
  best: boolean
  hidePromos: boolean
  logo: boolean
}

interface VideoPlayer extends Element {
  setPlaybackQualityRange?(quality: string): void
  setPlaybackQuality?(quality: string): void
  getPlaybackQuality?(): string
}

/** The page's window: `window` in the sandbox is not the site's own context. */
const page = (typeof unsafeWindow === 'undefined' ? window : unsafeWindow) as Window
  & typeof globalThis & { ytInitialPlayerResponse?: unknown }
const doc = page.document

const SETTINGS_KEY = 'youtube-premium.settings'
const DEFAULTS: Settings = { background: true, best: true, hidePromos: true, logo: true }
const AD_KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'] as const
const AD_SELECTORS = [
  '#player-ads',
  '#masthead-ad',
  'ytd-banner-promo-renderer',
  'ytd-video-masthead-ad-v3-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-ad-slot-renderer',
  'ytd-display-ad-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
  'ytm-promoted-sparkles-web-renderer',
  'ytm-companion-ad-renderer'
]
const PROMO_SELECTORS = [
  'ytd-statement-banner-renderer',
  'ytd-enforcement-message-view-model',
  'yt-mealbar-promo-renderer',
  'ytd-mealbar-promo-renderer',
  'tp-yt-paper-dialog:has(a[href="/premium"])',
  'ytd-popup-container ytd-mealbar-promo-renderer'
]

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await GM.getValue(SETTINGS_KEY, '')
    if (typeof raw === 'string' && raw.length > 0) {
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
    }
  } catch {
    // first run, or storage disabled: keep the defaults
  }
  return { ...DEFAULTS }
}

async function saveSettings(value: Settings): Promise<void> {
  try {
    await GM.setValue(SETTINGS_KEY, JSON.stringify(value))
  } catch {
    // storage is optional
  }
}

const settings = await loadSettings()

/** Deletes the advertisement fields a player response carries. */
function prunePlayerResponse(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const record = data as Record<string, unknown>
  let touched = false
  for (const key of AD_KEYS) {
    if (key in record) {
      record[key] = []
      touched = true
    }
  }
  const ads = record.playerResponse
  if (ads && typeof ads === 'object') prunePlayerResponse(ads)
  if (touched) return
}

function pruneJsonText(text: string): string {
  try {
    const parsed = JSON.parse(text) as unknown
    prunePlayerResponse(parsed)
    return JSON.stringify(parsed)
  } catch {
    return text
  }
}

// 1. Cold loads: the response YouTube inlines into the page.
let initialResponse: unknown = page.ytInitialPlayerResponse
prunePlayerResponse(initialResponse)
try {
  Object.defineProperty(page, 'ytInitialPlayerResponse', {
    configurable: true,
    get: () => initialResponse,
    set: (value: unknown) => {
      prunePlayerResponse(value)
      initialResponse = value
    }
  })
} catch {
  // already locked by the page: the fetch/XHR hooks below still apply
}

// 2. Warm loads: /youtubei/v1/player through fetch and XHR.
const nativeFetch = page.fetch?.bind(page)
if (nativeFetch) {
  page.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await nativeFetch(input, init)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.includes('/youtubei/v1/player')) return response
    const text = await response.clone().text()
    return new Response(pruneJsonText(text), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }) as typeof page.fetch
}

const xhrProto = page.XMLHttpRequest?.prototype
const nativeOpen = xhrProto?.open
const responseTextDescriptor = xhrProto ? Object.getOwnPropertyDescriptor(xhrProto, 'responseText') : undefined
if (xhrProto && nativeOpen && responseTextDescriptor?.get) {
  const getter = responseTextDescriptor.get
  xhrProto.open = function (this: XMLHttpRequest & { playerRequest?: boolean }, method: string, url: string, ...rest: unknown[]) {
    this.playerRequest = typeof url === 'string' && url.includes('/youtubei/v1/player')
    return (nativeOpen as (...args: unknown[]) => void).call(this, method, url, ...rest)
  } as typeof xhrProto.open
  Object.defineProperty(xhrProto, 'responseText', {
    configurable: true,
    get(this: XMLHttpRequest & { playerRequest?: boolean }) {
      const raw = getter.call(this) as string
      return this.playerRequest && typeof raw === 'string' && raw.length > 0 ? pruneJsonText(raw) : raw
    }
  })
}

// 3. Background playback: the player pauses when the tab is hidden.
function applyBackground(): boolean {
  if (!settings.background) return false
  try {
    Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false })
    Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' })
    return true
  } catch {
    return false
  }
}

// 4. Best quality + picture-in-picture, once the player exists.
let qualityAsked = false

function tunePlayer(): void {
  const video = doc.querySelector<HTMLVideoElement>('video')
  if (!video) return
  if (video.hasAttribute('disablepictureinpicture')) video.removeAttribute('disablepictureinpicture')

  if (!settings.best || qualityAsked) return
  const player = doc.querySelector<VideoPlayer>('#movie_player, .html5-video-player')
  if (!player?.setPlaybackQualityRange) return
  try {
    player.setPlaybackQualityRange('hd2160')
    player.setPlaybackQuality?.('hd2160')
    qualityAsked = true
  } catch {
    // the player API is not ready yet, the next sweep retries
  }
}

// 5. The masthead logo: swap the plain wordmark for the Premium one.
function swapLogo(): void {
  if (!settings.logo) return
  const host = doc.querySelector<HTMLElement>(
    'ytd-topbar-logo-renderer a#logo, ytd-topbar-logo-renderer #logo-icon, ytm-topbar-logo-renderer a'
  )
  if (!host || host.dataset.ytpLogo === '1') return

  const dark = doc.documentElement.hasAttribute('dark')
  const source = getResource(dark ? 'logo-dark.svg' : 'logo-light.svg')
  if (!source) return

  const image = doc.createElement('img')
  image.className = 'ytp-premium-logo'
  image.alt = 'YouTube Premium'
  image.src = source
  host.replaceChildren(image)
  host.dataset.ytpLogo = '1'
}

// 6. Anything that still slips through: kill it in the DOM.
function sweep(): void {
  if (!doc.body) return

  for (const selector of AD_SELECTORS) {
    for (const node of doc.querySelectorAll(selector)) node.remove()
  }
  if (settings.hidePromos) {
    for (const selector of PROMO_SELECTORS) {
      for (const node of doc.querySelectorAll(selector)) node.remove()
    }
  }

  for (const button of doc.querySelectorAll<HTMLElement>(
    '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button'
  )) {
    button.click()
  }

  const adPlaying = doc.querySelector('.ad-showing, .ad-interrupting')
  const video = doc.querySelector<HTMLVideoElement>('video')
  if (adPlaying && video) {
    video.muted = true
    if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration
  }

  tunePlayer()
  swapLogo()
}

const observer = new page.MutationObserver(sweep)
const start = (): void => {
  if (doc.body) observer.observe(doc.body, { childList: true, subtree: true })
  sweep()
}

if (doc.readyState === 'loading') {
  doc.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
// Cheap safety net for nodes YouTube re-inserts without a useful mutation record.
setInterval(sweep, 1500)

function toggle(name: keyof Settings): void {
  settings[name] = !settings[name]
  qualityAsked = false
  void saveSettings(settings)
  if (name === 'background' && settings.background) applyBackground()
  if (name === 'logo') {
    for (const host of doc.querySelectorAll<HTMLElement>('[data-ytp-logo]')) delete host.dataset.ytpLogo
  }
  sweep()
  console.info(`[youtube-premium] ${name} = ${settings[name]}`)
}

if (applyBackground()) {
  // re-assert after a client-side navigation replaces the document state
  doc.addEventListener('yt-navigate-finish', () => void applyBackground(), true)
}

GM.registerMenuCommand('Toggle background play', () => toggle('background'))
GM.registerMenuCommand('Toggle best quality', () => toggle('best'))
GM.registerMenuCommand('Toggle premium upsell hiding', () => toggle('hidePromos'))
GM.registerMenuCommand('Toggle premium logo', () => toggle('logo'))

// Re-pick the light/dark wordmark when the theme changes.
new page.MutationObserver(() => {
  for (const host of doc.querySelectorAll<HTMLElement>('[data-ytp-logo]')) delete host.dataset.ytpLogo
  swapLogo()
}).observe(doc.documentElement, { attributes: true, attributeFilter: ['dark'] })
