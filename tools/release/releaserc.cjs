'use strict'

/**
 * One semantic-release config for every userscript, parameterised by the folder it
 * runs in: `cd scripts/<slug> && semantic-release --extends ../../tools/release/releaserc.cjs`
 *
 * Each script therefore owns:
 *   - its own version in `scripts/<slug>/package.json` (the build reads @version from there)
 *   - its own tags `<slug>@vX.Y.Z` (so scripts never bump each other)
 *   - its own `scripts/<slug>/CHANGELOG.md`
 *   - its own GitHub release
 *
 * Commits are filtered by `scope-commits.cjs` before the bump is computed, so a push
 * that only touches one script releases only that script.
 */

const { existsSync, readFileSync } = require('node:fs')
const { basename, join, resolve } = require('node:path')

const cwd = process.cwd()
const pkgFile = join(cwd, 'package.json')

if (!existsSync(pkgFile)) {
  throw new Error(`no package.json in ${cwd}: run semantic-release from a scripts/<slug> folder`)
}

const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
const slug = basename(cwd)
const scope = join(__dirname, 'scope-commits.cjs')

// one repository URL for the whole repo, read from the root package.json
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
const repositoryUrl
  = process.env.SEMANTIC_RELEASE_REPOSITORY_URL ?? (typeof rootPkg.repository === 'string' ? rootPkg.repository : rootPkg.repository?.url)

module.exports = {
  repositoryUrl,
  branches: ['main'],
  tagFormat: slug + '@v${version}',
  plugins: [
    // must stay first: it computes the bump and the notes from this folder's commits only
    [scope, { dir: cwd }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md', changelogTitle: `# ${pkg.name} changelog` }],
    ['@semantic-release/npm', { npmPublish: false, pkgRoot: '.' }],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: `chore(release): ${slug}@\${nextRelease.version} [skip ci]\n\n\${nextRelease.notes}`
      }
    ],
    [
      '@semantic-release/github',
      {
        successComment: false,
        failTitle: false,
        releasedLabels: false
      }
    ]
  ]
}
