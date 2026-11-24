import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = join(import.meta.dir, '../..')
const RELEASERC = join(REPO, 'tools/release/releaserc.cjs')
const SEMANTIC_RELEASE = join(REPO, 'node_modules/semantic-release/bin/semantic-release.js')

/**
 * Production config restricted to the plugins listed in `keep`. The GitHub plugin
 * needs a live repo and is therefore never used here; the rest of the pipeline
 * (scoping, version, changelog, git commit + tag) is the real thing.
 */
function configWith(keep: string[]): string {
  return `
const base = require(${JSON.stringify(RELEASERC)})
const keep = ${JSON.stringify(keep)}
module.exports = {
  ...base,
  plugins: base.plugins.filter(plugin => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin
    return keep.includes(name) || name.includes('scope-commits')
  })
}
`
}

/** dry run: nothing is written, so only the commit-reading steps matter. */
const DRY_CONFIG = configWith(['@semantic-release/changelog'])
/** real run: everything except the GitHub plugin. */
const LOCAL_CONFIG = configWith([
  '@semantic-release/changelog',
  '@semantic-release/npm',
  '@semantic-release/git'
])

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function write(path: string, content: string): void {
  writeFileSync(path, content)
}

/** A throwaway repo with two folders, tagged at demo@v1.0.0. */
function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'usm-release-'))
  dirs.push(root)
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'user.email', 'release@example.test')
  git(root, 'config', 'user.name', 'release')
  // the sandbox has gpg/editor less git defaults that would open an editor
  git(root, 'config', 'tag.gpgSign', 'false')
  git(root, 'config', 'commit.gpgsign', 'false')

  mkdirSync(join(root, 'scripts/demo'), { recursive: true })
  mkdirSync(join(root, 'scripts/other'), { recursive: true })
  symlinkSync(join(REPO, 'node_modules'), join(root, 'node_modules'))
  write(join(root, 'scripts/demo/package.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }))
  write(join(root, 'scripts/demo/index.ts'), '// demo\n')
  write(join(root, 'scripts/other/index.ts'), '// other\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-m', 'chore: init')
  git(root, 'tag', 'demo@v1.0.0')
  git(root, 'tag', 'other@v1.0.0')

  // an offline "remote": git rewrites the GitHub URL to a local bare repo, so
  // semantic-release sees a normal GitHub repo and still works without network
  const origin = join(root, 'origin.git')
  // `--initial-branch` matters: a bare repo whose HEAD points at a branch that
  // does not exist makes semantic-release's `git fetch <url>` fail with
  // "couldn't find remote ref HEAD" on machines whose default branch is master.
  execFileSync('git', ['init', '--bare', '--initial-branch=main', '-q', origin])
  git(root, 'remote', 'add', 'origin', 'https://github.com/adfree-app/userscript.git')
  git(root, 'config', `url.file://${origin}.insteadOf`, 'https://github.com/adfree-app/userscript.git')
  git(root, 'push', '-q', 'origin', 'main', '--tags')
  write(join(root, 'releaserc.dry.cjs'), DRY_CONFIG)
  write(join(root, 'releaserc.local.cjs'), LOCAL_CONFIG)
  return root
}

/**
 * Environment for the sandboxed runs.
 *
 * `CI` and the provider's own `GITHUB_*` variables have to go: semantic-release
 * trusts them over the local git state, and on a runner it then reads a branch
 * named `undefined` and refuses to release. The fixture repo is not the CI
 * repository, so nothing about the runner applies to it.
 */
function sandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(CI|CI_.*|GITHUB_.*|GITLAB_.*|CIRCLE_.*|TRAVIS.*|BUILDKITE.*|BITBUCKET.*)$/.test(key)) continue
    env[key] = value
  }
  return {
    ...env,
    GH_TOKEN: 'dry-run',
    GIT_AUTHOR_NAME: 'release',
    GIT_AUTHOR_EMAIL: 'release@example.test',
    GIT_COMMITTER_NAME: 'release',
    GIT_COMMITTER_EMAIL: 'release@example.test'
  }
}

function release(root: string, slug: string, dryRun = true): { out: string, code: number } {
  try {
    const out = execFileSync(
      'node',
      [
        SEMANTIC_RELEASE,
        ...(dryRun ? ['--dry-run'] : []),
        '--no-ci',
        '--extends',
        join(root, dryRun ? 'releaserc.dry.cjs' : 'releaserc.local.cjs'),
        '--branches',
        'main'
      ],
      {
        cwd: join(root, 'scripts', slug),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: sandboxEnv()
      }
    )
    return { out, code: 0 }
  } catch (error) {
    const failure = error as { stdout?: string, stderr?: string, status?: number }
    return { out: `${failure.stdout ?? ''}${failure.stderr ?? ''}`, code: failure.status ?? 1 }
  }
}

const DEMO = join('scripts', 'demo')

describe('per-script release scoping', () => {
  test('a commit inside the script bumps that script', () => {
    const root = fixtureRepo()
    write(join(root, DEMO, 'index.ts'), '// demo v2\n')
    git(root, 'commit', '-am', 'feat(demo): add a shiny button')

    const { out, code } = release(root, 'demo')
    expect(code, out).toBe(0)
    expect(out).toContain('1.1.0')
    expect(out).toContain('add a shiny button')
  }, 60_000)

  test('a commit outside the script releases nothing there', () => {
    const root = fixtureRepo()
    write(join(root, 'scripts/other/index.ts'), '// other v2\n')
    git(root, 'commit', '-am', 'fix(other): unrelated work')

    const { out, code } = release(root, 'demo')
    expect(code, out).toBe(0)
    // the filtered commit list is empty, so semantic-release finds no release
    expect(out).not.toContain('unrelated work')
    expect(out).toMatch(/There are no relevant changes|no release/i)
  }, 60_000)

  test('only this folder\u2019s commits reach the release notes', () => {
    const root = fixtureRepo()
    write(join(root, DEMO, 'index.ts'), '// demo v2\n')
    git(root, 'commit', '-am', 'fix(demo): keep the panel on screen')
    write(join(root, 'scripts/other/index.ts'), '// other v2\n')
    git(root, 'commit', '-am', 'feat(other): other feature')

    const { out, code } = release(root, 'demo')
    expect(code, out).toBe(0)
    expect(out).toContain('keep the panel on screen')
    expect(out).not.toContain('other feature')
    expect(out).toContain('1.0.1') // fix -> patch, not minor
  }, 60_000)

  test('a real run bumps package.json, writes CHANGELOG.md and tags its own version', () => {
    const root = fixtureRepo()
    write(join(root, DEMO, 'index.ts'), '// demo v2\n')
    git(root, 'commit', '-am', 'feat(demo): add a shiny button')

    const { out, code } = release(root, 'demo', false)
    expect(code, out).toBe(0)

    const pkg = JSON.parse(readFileSync(join(root, DEMO, 'package.json'), 'utf8')) as { version: string }
    expect(pkg.version).toBe('1.1.0')

    const changelog = readFileSync(join(root, DEMO, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toMatch(/^# \[?1\.1\.0/m)
    expect(changelog).toContain('add a shiny button')

    // its own tag, pushed to the remote
    expect(git(root, 'tag', '--list').split('\n')).toContain('demo@v1.1.0')
    expect(git(root, 'ls-remote', '--tags', 'origin')).toContain('refs/tags/demo@v1.1.0')

    // the release commit only touches that folder
    const changed = git(root, 'show', '--name-only', '--pretty=format:', 'HEAD').trim().split('\n')
    expect(changed.every(file => file.startsWith('scripts/demo/'))).toBe(true)
    expect(git(root, 'show', 'HEAD:scripts/other/index.ts')).toBe('// other\n')
  }, 60_000)
})
