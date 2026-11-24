'use strict'

/**
 * semantic-release plugin: only look at the commits that touched one folder.
 *
 * semantic-release clones the context for every plugin and does not expose which
 * files a commit changed, so this plugin replaces the two commit-reading steps
 * (`analyzeCommits`, `generateNotes`) with the stock plugins called on a filtered
 * commit list. Everything else — tag discovery, version bump, changelog, git
 * commit/push, GitHub release — stays semantic-release's job.
 *
 * Layout: pass the folder to scope by as `dir` (defaults to process.cwd()), which
 * is the script folder when `semantic-release` runs inside `scripts/<slug>/`.
 */

const { execFileSync } = require('node:child_process')
const { isAbsolute, relative, resolve, sep } = require('node:path')

/** Files each commit touched, repo-root relative. */
function changedFiles(hash, cwd) {
  const out = execFileSync('git', ['show', '--pretty=format:', '--name-only', '--no-renames', hash], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  return out
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

/** Drops every commit that did not touch `dir`. */
function scopedCommits(commits, dir, cwd = dir) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  const target = relative(root, isAbsolute(dir) ? dir : resolve(cwd, dir)).split(sep).join('/')
  const prefix = `${target}/`
  const cache = new Map()

  return commits.filter((commit) => {
    let files = cache.get(commit.hash)
    if (!files) {
      files = changedFiles(commit.hash, cwd)
      cache.set(commit.hash, files)
    }
    return files.some(file => file === target || file.startsWith(prefix))
  })
}

function folderOf(pluginConfig, context) {
  return pluginConfig.dir ?? context.cwd ?? process.cwd()
}

async function analyzeCommits(pluginConfig, context) {
  const commits = scopedCommits(context.commits, folderOf(pluginConfig, context))
  context.logger.log(
    `Scoped to ${commits.length}/${context.commits.length} commit(s) under ${folderOf(pluginConfig, context)}`
  )
  const { analyzeCommits: analyze } = await import('@semantic-release/commit-analyzer')
  return analyze(pluginConfig.analyzer ?? {}, { ...context, commits })
}

async function generateNotes(pluginConfig, context) {
  const commits = scopedCommits(context.commits, folderOf(pluginConfig, context))
  const { generateNotes: generateNotesFrom } = await import('@semantic-release/release-notes-generator')
  return generateNotesFrom(pluginConfig.notes ?? {}, { ...context, commits })
}

module.exports = { analyzeCommits, generateNotes, scopedCommits }
