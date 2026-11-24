/**
 * The bridge the AdFree app injects into this store's pages
 * (`rust/assets/store_api.js` in the app). Outside the app it is simply absent,
 * and the page falls back to handing the `.user.js` URL to a browser userscript
 * manager.
 */

export interface InstalledScript {
  id: string
  name: string
  url: string
  key: string
  version: string
}

export interface AdFreeBridge {
  available: true
  list: () => Promise<InstalledScript[]>
  installed: (url: string) => InstalledScript | null
  has: (url: string) => boolean
  stale: (url: string, version?: string) => boolean
  install: (url: string) => Promise<InstalledScript>
  update: (url: string) => Promise<InstalledScript>
  remove: (url: string) => Promise<{ name?: string }>
  keyFor: (url: string) => string
  onChange: (callback: () => void) => () => void
}

declare global {
  interface Window {
    adfree?: AdFreeBridge
    /** The payload the app writes before the bridge runs. */
    __adfree_store?: { api: string, token: string, host: string, installed: InstalledScript[] }
  }
}

/** One script's state on this machine. */
export type ScriptState = 'absent' | 'installed' | 'outdated'

/**
 * The bridge, or `null` outside the app. Read through a function rather than at
 * import time: the app writes its payload into `<head>`, but this component may
 * still be mounted before the bridge's own script has run.
 */
export function bridge(): AdFreeBridge | null {
  if (typeof window === 'undefined') return null
  const api = window.adfree
  return api && api.available ? api : null
}

/** Whether the app is driving this page right now, reactively. */
export function useAdFree() {
  const inApp = ref(false)
  const revision = ref(0)

  onMounted(() => {
    if (bridge()) {
      inApp.value = true
      return
    }
    // A page opened inside the app is handed the bridge while the app is still
    // injecting it: this component can mount before its script runs.
    const timer = window.setInterval(() => {
      if (!bridge()) return
      window.clearInterval(timer)
      inApp.value = true
    }, 120)
    window.setTimeout(() => window.clearInterval(timer), 4000)
    document.addEventListener('adfree:ready', () => (inApp.value = true), { once: true })
  })

  const api = computed(() => (inApp.value ? bridge() : null))

  let off: (() => void) | undefined

  // Subscribing here, not in each card: the drawer and every card have to agree
  // on what is installed, and one listener is enough for all of them.
  watch(
    api,
    (value) => {
      off?.()
      off = undefined
      if (!value) return
      off = value.onChange(() => (revision.value += 1))
      // the list the app wrote into the page is the first one we have
      revision.value += 1
    },
    { immediate: true }
  )

  onUnmounted(() => off?.())

  return { inApp, revision, api }
}

/** `installed` / `outdated` for one script, given the bridge's list. */
export function stateOf(
  api: AdFreeBridge | null,
  url: string,
  version: string
): ScriptState {
  if (!api) return 'absent'
  if (!api.has(url)) return 'absent'
  return api.stale(url, version) ? 'outdated' : 'installed'
}
