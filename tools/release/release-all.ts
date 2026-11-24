#!/usr/bin/env bun
/**
 * Runs semantic-release once per `scripts/<slug>/` folder.
 *
 * Each run is independent: semantic-release looks at that folder's own tag
 * (`<slug>@vX.Y.Z`), gets its own commit list, filters it down to commits that
 * touched that folder (tools/release/scope-commits.cjs), bumps that folder's
 * `package.json`, writes that folder's `CHANGELOG.md`, commits, tags and pushes.
 * A folder with no relevant commit is skipped by semantic-release itself.
 *
 * Usage: `bun tools/release/release-all.ts` (CI) or `DRY_RUN=1 ...` (local preview).
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../..')
const scriptsDir = join(root, 'scripts')
const config = join(root, 'tools/release/releaserc.cjs')
const bin = join(root, 'node_modules/semantic-release/bin/semantic-release.js')
const dryRun = process.env.DRY_RUN === '1'

const slugs = readdirSync(scriptsDir)
  .filter(name => statSync(join(scriptsDir, name)).isDirectory())
  .filter(name => statSync(join(scriptsDir, name, 'package.json'), { throwIfNoEntry: false }))
  .sort()

if (slugs.length === 0) {
  console.log('no script with a package.json in scripts/ — nothing to release')
  process.exit(0)
}

console.log(`${dryRun ? 'dry run' : 'release'} for ${slugs.length} script(s): ${slugs.join(', ')}`)

const args = [bin, '--extends', config, '--branches', 'main']
if (dryRun) args.push('--dry-run')
if (!process.env.CI) args.push('--no-ci')

let failed = 0
for (const slug of slugs) {
  console.log(`\n=== ${slug} ===`)
  const result = Bun.spawnSync(['node', ...args], {
    cwd: join(scriptsDir, slug),
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env
  })
  if (result.exitCode !== 0) failed += 1
}

if (failed > 0) {
  console.error(`\n${failed} script release(s) failed`)
  process.exit(1)
}
console.log('\nall script releases finished')
