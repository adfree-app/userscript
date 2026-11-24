import { describe, expect, test } from 'bun:test'
import { createHarness } from 'userscript-maker/testing'

type Harness = Awaited<ReturnType<typeof createHarness>>

const PAGE = `
  <ytd-topbar-logo-renderer>
    <a id="logo" href="/"><yt-icon id="logo-icon"><svg width="90" height="20"></svg></yt-icon></a>
  </ytd-topbar-logo-renderer>
  <div id="player-ads">sidebar ad</div>
  <ytd-ad-slot-renderer>masthead ad</ytd-ad-slot-renderer>
  <ytd-statement-banner-renderer>Try Premium</ytd-statement-banner-renderer>
  <div id="movie_player" class="html5-video-player ad-showing">
    <video class="html5-main-video" disablepictureinpicture></video>
    <button class="ytp-ad-skip-button-modern">Skip</button>
  </div>
`

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

async function harness(): Promise<Harness> {
  const view = await createHarness(import.meta.dir, { url: URL, html: PAGE })
  view.run()
  await Bun.sleep(20)
  return view
}

describe('youtube-premium', () => {
  test('strips the ad fields from a late ytInitialPlayerResponse', async () => {
    const view = await harness()
    try {
      ;(view.window as unknown as { ytInitialPlayerResponse: Record<string, unknown> }).ytInitialPlayerResponse = {
        videoDetails: { videoId: 'abc' },
        adPlacements: [{ x: 1 }],
        playerAds: [{ y: 1 }],
        adSlots: [{ z: 1 }]
      }
      const response = (view.window as unknown as { ytInitialPlayerResponse: Record<string, unknown> })
        .ytInitialPlayerResponse
      expect(response.adPlacements).toEqual([])
      expect(response.playerAds).toEqual([])
      expect(response.adSlots).toEqual([])
      expect((response.videoDetails as { videoId: string }).videoId).toBe('abc')
    } finally {
      view.dispose()
    }
  }, 20_000)

  test('a response set before the script runs keeps its data but loses its ads', async () => {
    const view = await createHarness(import.meta.dir, { url: URL, html: PAGE })
    try {
      const target = view.window as unknown as { ytInitialPlayerResponse: Record<string, unknown> }
      target.ytInitialPlayerResponse = { videoDetails: { title: 'x' }, adPlacements: [{ a: 1 }] }
      view.run()
      await Bun.sleep(20)
      expect(target.ytInitialPlayerResponse.adPlacements).toEqual([])
      expect((target.ytInitialPlayerResponse.videoDetails as { title: string }).title).toBe('x')
    } finally {
      view.dispose()
    }
  }, 20_000)

  test('removes ad slots and the premium upsell banner', async () => {
    const view = await harness()
    try {
      const document = view.document
      expect(document.getElementById('player-ads')).toBeNull()
      expect(document.querySelector('ytd-ad-slot-renderer')).toBeNull()
      expect(document.querySelector('ytd-statement-banner-renderer')).toBeNull()
    } finally {
      view.dispose()
    }
  }, 20_000)

  test('clicks the skip button, drops the PiP lock and reports a visible tab', async () => {
    const view = await createHarness(import.meta.dir, { url: URL, html: PAGE })
    let skipped = 0
    view.document.querySelector('.ytp-ad-skip-button-modern')!.addEventListener('click', () => {
      skipped += 1
    })
    view.run()
    await Bun.sleep(20)
    try {
      expect(skipped).toBeGreaterThan(0)
      const video = view.document.querySelector('video') as HTMLVideoElement
      expect(video.hasAttribute('disablepictureinpicture')).toBe(false)
      expect(view.document.hidden).toBe(false)
      expect(view.document.visibilityState).toBe('visible')
    } finally {
      view.dispose()
    }
  }, 20_000)

  test('swaps the masthead wordmark for the Premium logo, following the theme', async () => {
    const view = await harness()
    try {
      const host = view.document.getElementById('logo')!
      const light = host.querySelector('img.ytp-premium-logo') as HTMLImageElement | null
      expect(light?.alt).toBe('YouTube Premium')
      expect(light?.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true)
      expect(host.querySelector('yt-icon')).toBeNull()

      ;(view.document.documentElement as HTMLElement).setAttribute('dark', '')
      await Bun.sleep(30)
      const dark = host.querySelector('img.ytp-premium-logo') as HTMLImageElement | null
      expect(dark?.getAttribute('src')).not.toBe(light?.getAttribute('src'))
    } finally {
      view.dispose()
    }
  }, 20_000)
})
