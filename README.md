# Nuxt Starter Template

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Use this template to get started with [Nuxt UI](https://ui.nuxt.com) quickly.

- [Live demo](https://starter-template.nuxt.dev/)
- [Documentation](https://ui.nuxt.com/docs/getting-started/installation/nuxt)

<a href="https://starter-template.nuxt.dev/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png">
    <img alt="Nuxt Starter Template" src="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png" width="830" height="466">
  </picture>
</a>

> The starter template for Vue is on https://github.com/nuxt-ui-templates/starter-vue.

## Quick Start

```bash [Terminal]
npm create nuxt@latest -- -t ui
```

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-name=starter&repository-url=https%3A%2F%2Fgithub.com%2Fnuxt-ui-templates%2Fstarter&demo-image=https%3A%2F%2Fui.nuxt.com%2Fassets%2Ftemplates%2Fnuxt%2Fstarter-dark.png&demo-url=https%3A%2F%2Fstarter-template.nuxt.dev%2F&demo-title=Nuxt%20Starter%20Template&demo-description=A%20minimal%20template%20to%20get%20started%20with%20Nuxt%20UI.)

## Setup

Make sure to install the dependencies:

```bash
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
bun run dev
```

## Production

This app runs in **SPA mode** (`ssr: false` in `nuxt.config.ts`) and builds to pure static files, so no
Node server is needed. `bun run build` generates `.output/public`:

```bash
bun run build     # = nuxt generate
```

Locally preview the static output:

```bash
npx serve .output/public
```

Deploy `.output/public` to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel static,
Nginx, S3 + CDN). Deep links must fall back to `index.html`; `public/_redirects` already covers
Netlify/Cloudflare Pages. For Nginx:

```nginx
try_files $uri $uri/ /index.html;
```

Need server rendering again? Set `ssr: true` (and remove `nitro.preset`) or run `bun run build:ssr`.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.

## Userscripts

Every script lives in its own folder under `scripts/` and is compiled by
[`userscript-maker`](packages/userscript-maker) into a plain `.user.js`:

```
scripts/popup-blocker/
  index.ts        defineMeta({...}) + body
  index.css       optional, inlined as GM_addStyle
  package.json    name + version — the version is what @version comes from
  CHANGELOG.md    written by semantic-release
  fixture.html    page used by the harness / tests
  popup.test.ts   happy-dom tests
```

`userscript.config.ts` at the repo root holds the shared metadata (namespace,
author, base URL, size budget), so `usm build`, `usm check`, `usm catalog` and
`usm dev` need no arguments. Built files land in `public/userscripts/`
(`<slug>.user.js` + `catalog.json`).

### Releasing one script at a time

`.github/workflows/release.yml` runs semantic-release once per `scripts/<slug>/`
folder, and each folder owns its version, tag, changelog and GitHub release:

| piece | value for `scripts/popup-blocker` |
| --- | --- |
| version | `scripts/popup-blocker/package.json` (read by the build) |
| tag | `popup-blocker@v1.2.3` |
| changelog | `scripts/popup-blocker/CHANGELOG.md` |
| release | GitHub release on that tag |

Commits are scoped first: `tools/release/scope-commits.cjs` keeps only the commits
that touched the script folder (checked with `git show --name-only`), then the
normal conventional-commit rules decide the bump. A push touching only one script
therefore never bumps the others, and a folder with no relevant commit is skipped.

```
bun run release:dry     # preview every script's next version, nothing written
bun run release:scripts # what CI runs (needs a git remote + GITHUB_TOKEN)
```

After the releases, the workflow rebuilds `public/userscripts/` and commits the
fresh bundles, so `@updateURL` points at the released version.

## The store

`app/pages/index.vue` is the store: a card per script, a details drawer, and
Install / Update / Remove on each card. It reads
`public/userscripts/catalog.json` at runtime (written by `usm catalog`), so a
release shows up without rebuilding the app; the cards link straight at
`userscripts/<slug>.user.js`, which is what a userscript manager installs.

`app/utils/catalog.ts` holds the derivations (install URL, sizes, host summary,
permissions) and is unit tested in `app/utils/catalog.test.ts`.

### Inside AdFree

The app injects a bridge into this store's pages — `rust/assets/store_api.js` in
the AdFree repository, gated to `adfree-app.github.io/userscript/*` — and the
page calls it instead of opening raw files:

```js
window.adfree.available           // true when the app is driving the page
await window.adfree.install(url)  // promise; also the update path
await window.adfree.remove(url)
await window.adfree.list()        // what the app has, refreshed
window.adfree.has(url)            // boolean, from the injected list
window.adfree.stale(url, version) // a newer version is on offer
window.adfree.onChange(fn)        // returns an unsubscribe
```

`document` also gets `adfree:ready` and `adfree:changed`. Outside the app the
bridge is absent, `useAdFree()` says so, and the install button simply opens the
`.user.js` — Tampermonkey, Violentmonkey and Greasemonkey take it from there and
keep it current through `@updateURL`.
