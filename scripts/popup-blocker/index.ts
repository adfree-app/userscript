import { defineMeta } from 'userscript-maker'
import 'userscript-maker/gm'

defineMeta({
  name: 'Popup Blocker (strict)',
  description:
    'Blocks every popup request — window.open(), target="_blank" links and forms — then asks: deny, allow, open in a background tab, or go there now.',
  license: 'MIT',
  match: ['*://*/*'],
  grant: ['unsafeWindow'],
  runAt: 'document-start',
  noframes: true
})

type Kind = 'open' | 'link' | 'form'

interface Blocked {
  url: string
  kind: Kind
  count: number
}

interface Ui {
  host: HTMLElement
  count: HTMLElement
  list: HTMLElement
  empty: HTMLElement
}

/** The page's own window: patching `open` inside the sandbox would not reach the site. */
const page = (typeof unsafeWindow === 'undefined' ? window : unsafeWindow) as Window
  & typeof globalThis & { open: typeof window.open }
const nativeOpen = page.open.bind(page)

const blocked = new Map<string, Blocked>()
let allowNext = 0
let ui: Ui | null = null

function root(): HTMLElement {
  return document.body ?? document.documentElement
}

function absolute(url: string): string {
  try {
    return new URL(url, location.href).href
  } catch {
    return url
  }
}

function label(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    const query = parsed.search ? '?…' : ''
    return `${parsed.host}${path}${query}`
  } catch {
    return url
  }
}

function flash(): void {
  if (!ui) return
  ui.host.dataset.flash = '1'
  setTimeout(() => {
    if (ui) delete ui.host.dataset.flash
  }, 400)
}

function ensureUi(): Ui {
  if (ui) return ui

  const host = document.createElement('section')
  host.id = 'usm-popup-blocker'
  host.setAttribute('role', 'dialog')
  host.setAttribute('aria-label', 'Blocked popups')

  const header = document.createElement('header')

  const title = document.createElement('span')
  title.className = 'title'
  title.textContent = 'Popup blocked'

  const count = document.createElement('span')
  count.className = 'count'

  const denyAll = document.createElement('button')
  denyAll.type = 'button'
  denyAll.className = 'ghost'
  denyAll.textContent = 'Deny all'
  denyAll.addEventListener('click', () => {
    blocked.clear()
    render()
  })

  header.append(title, count, denyAll)

  const list = document.createElement('ul')
  list.className = 'list'

  const empty = document.createElement('p')
  empty.className = 'empty'
  empty.textContent = 'No popups waiting.'

  host.append(header, list, empty)
  root().append(host)
  ui = { host, count, list, empty }
  return ui
}

function decide(url: string): void {
  blocked.delete(url)
  render()
}

function openInTab(url: string): void {
  allowNext += 1
  nativeOpen(url, '_blank', 'noopener')
}

function openInBackground(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.hidden = true
  root().append(anchor)
  allowNext += 1
  anchor.click()
  setTimeout(() => anchor.remove(), 0)
}

function row(entry: Blocked): HTMLLIElement {
  const item = document.createElement('li')

  const target = document.createElement('div')
  target.className = 'target'

  const url = document.createElement('span')
  url.className = 'url'
  url.textContent = label(entry.url)
  url.title = entry.url
  target.append(url)

  if (entry.count > 1) {
    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = `×${entry.count}`
    badge.title = `requested ${entry.count} times`
    target.append(badge)
  }

  const kind = document.createElement('span')
  kind.className = 'kind'
  kind.textContent
    = entry.kind === 'open' ? 'window.open()' : entry.kind === 'link' ? 'link · target=_blank' : 'form · new window'
  target.append(kind)

  const actions = document.createElement('div')
  actions.className = 'actions'
  const choices: Array<[string, string, () => void]> = [
    ['deny', 'Deny', () => decide(entry.url)],
    [
      'allow',
      'Allow',
      () => {
        decide(entry.url)
        openInTab(entry.url)
      }
    ],
    [
      'back',
      'Bg tab',
      () => {
        decide(entry.url)
        openInBackground(entry.url)
      }
    ],
    [
      'go',
      'Go',
      () => {
        decide(entry.url)
        location.assign(entry.url)
      }
    ]
  ]

  for (const [kindName, text, action] of choices) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = kindName
    button.textContent = text
    button.addEventListener('click', action)
    actions.append(button)
  }

  item.append(target, actions)
  return item
}

function render(): void {
  const view = ensureUi()
  view.list.replaceChildren()
  for (const entry of blocked.values()) view.list.append(row(entry))

  const total = [...blocked.values()].reduce((sum, entry) => sum + entry.count, 0)
  view.count.textContent
    = blocked.size === 0 ? '' : total > blocked.size ? `${blocked.size} urls · ${total} tries` : `${blocked.size}`
  view.empty.hidden = blocked.size > 0
  view.host.hidden = blocked.size === 0
  view.host.classList.toggle('active', blocked.size > 0)
  flash()
}

function block(url: string, kind: Kind): void {
  const target = absolute(url)
  const existing = blocked.get(target)
  if (existing) existing.count += 1
  else blocked.set(target, { url: target, kind, count: 1 })
  render()
}

// 1. window.open() — the main popup channel.
page.open = ((url?: string | URL, target?: string, features?: string) => {
  if (allowNext > 0) {
    allowNext -= 1
    return nativeOpen(String(url ?? ''), target ?? '_blank', features)
  }
  if (!url) return null
  block(String(url), 'open')
  return null
}) as typeof page.open

// 2. links that ask for a new window.
document.addEventListener(
  'click',
  (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    const source = event.target as Element | null
    if (source?.closest?.('#usm-popup-blocker')) return
    const anchor = source?.closest?.('a[target="_blank"], area[target="_blank"]') as HTMLAnchorElement | null
    if (!anchor?.href) return
    if (event.ctrlKey || event.metaKey || event.shiftKey) return
    if (allowNext > 0) {
      allowNext -= 1
      return
    }
    event.preventDefault()
    event.stopPropagation()
    block(anchor.href, 'link')
  },
  true
)

// 3. forms that submit into a new window.
document.addEventListener(
  'submit',
  (event) => {
    const form = event.target as HTMLFormElement | null
    if (form?.tagName !== 'FORM') return
    const target = (form.getAttribute('target') ?? '').toLowerCase()
    if (!target || target === '_self' || target === '_top' || target === '_parent') return
    if (allowNext > 0) {
      allowNext -= 1
      return
    }
    event.preventDefault()
    event.stopPropagation()
    block(form.getAttribute('action') || location.href, 'form')
  },
  true
)
