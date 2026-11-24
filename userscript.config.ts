import type { MakerConfig } from 'userscript-maker'

/**
 * `usm` reads this file from the working directory, so `usm build`, `usm check`,
 * `usm catalog` and `usm dev` need no arguments and no flags.
 *
 * Flags on the command line still win over the values below.
 */
export default {
  // every folder under scripts/ that has an index.ts
  scripts: ['scripts/popup-blocker', 'scripts/youtube-premium'],

  // shared metadata: a script that leaves `namespace`/`author` out gets
  // `<namespace>/<slug>` and this author, so defineMeta() stays short
  namespace: 'https://github.com/adfree-app/userscript/tree/main/scripts',
  author: 'tachibana-shin',

  // a body over this size is reported as an error — keeps the bundle in check
  budget: 30_000,

  // NOTE: `outDir` is not set here on purpose. The CLI hands `-o, --out` a default
  // of `dist`, and that default beats this file, so the output folder is passed per
  // command in package.json (`usm build --out public/userscripts`) instead.

  // flip to true for release builds: `usm build --minify`
  minify: false,

  // add @updateURL/@downloadURL: `usm build --base-url https://your.site/userscripts`
  // (left empty locally so the header stays clean)
  // GitHub Pages serves the repo root at /userscript/, and the files sit in public/userscripts/
  baseUrl: 'https://adfree-app.github.io/userscript/userscripts'
} satisfies MakerConfig
