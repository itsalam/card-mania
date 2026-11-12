#!/usr/bin/env node
// Weekly client status post (ITS-66): draft on Monday morning, you review, then post to Basecamp.
//
// Usage:
//   npm run status:draft [-- --week-of 2026-11-02] [--ai] [--force] [--notify]
//   npm run status:edit                 open the latest draft in your editor
//   npm run status:send [-- --dry-run] [--yes] [--file path] [--force]
//
// Drafts live in ~/.card-mania-ops/status/<monday>.md. The draft's week defaults to the last full
// Mon–Sun week. Posting goes through `claude -p` with only the Basecamp create_message tool allowed,
// reusing the Basecamp MCP connection that's already authorized for this repo.

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { computeHours, sumHours, sync } from './hours.mjs'
import {
  addDays,
  formatRange,
  loadConfig,
  mondayOf,
  notify,
  OPS_DIR,
  opsPath,
  parseArgs,
  parseDay,
  REPO_ROOT,
  resolveDay,
  run,
  today,
} from './lib.mjs'
import { mdToHtml } from './md-to-html.mjs'

const STATUS_DIR = opsPath('status')

// --- Frontmatter (flat `key: value` only)

export function parseDraft(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: text }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: match[2] }
}

export function serializeDraft(meta, body) {
  const head = Object.entries(meta)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return `---\n${head}\n---\n\n${body.trim()}\n`
}

// --- Data sources

/** Expands "ITS-60/61/62: …" into ['ITS-60', 'ITS-61', 'ITS-62']. */
export function issueIdsIn(text, team) {
  const ids = []
  for (const m of text.matchAll(new RegExp(`${team}-(\\d+(?:/\\d+)*)`, 'g'))) {
    for (const n of m[1].split('/')) ids.push(`${team}-${n}`)
  }
  return ids
}

function mergedPullRequests(config, start, endExclusive) {
  const { repo, baseBranches } = config.status.github
  const from = parseDay(start).getTime()
  const to = parseDay(endExclusive).getTime()
  const prs = []
  for (const base of baseBranches) {
    // GitHub search dates are UTC; widen by a day and filter precisely on mergedAt below
    const search = `merged:${addDays(start, -1)}..${endExclusive}`
    const json = run('gh', [
      'pr',
      'list',
      '--repo',
      repo,
      '--state',
      'merged',
      '--base',
      base,
      '--search',
      search,
      '--limit',
      '100',
      '--json',
      'number,title,url,mergedAt',
    ])
    for (const pr of JSON.parse(json)) {
      const t = Date.parse(pr.mergedAt)
      if (t >= from && t < to) prs.push(pr)
    }
  }
  return prs.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))
}

function linearIssues(config, start, endExclusive) {
  const team = JSON.stringify(config.status.linearTeam)
  const gte = JSON.stringify(parseDay(start).toISOString())
  const lt = JSON.stringify(parseDay(endExclusive).toISOString())
  const fields = 'nodes { identifier title url parent { identifier parent { identifier } } }'
  const query = `{
    done: issues(first: 100, filter: { team: { key: { eq: ${team} } }, completedAt: { gte: ${gte}, lt: ${lt} } }) { ${fields} }
    active: issues(first: 50, filter: { team: { key: { eq: ${team} } }, state: { type: { eq: "started" } } }) { ${fields} }
  }`
  const { data, errors } = JSON.parse(run('linear', ['api'], { input: query }))
  if (errors?.length) throw new Error(`Linear: ${errors.map((e) => e.message).join('; ')}`)

  const excluded = new Set(config.status.excludeIssues)
  const isInternal = (issue) =>
    excluded.has(issue.identifier) ||
    excluded.has(issue.parent?.identifier) ||
    excluded.has(issue.parent?.parent?.identifier)
  return {
    done: data.done.nodes.filter((i) => !isInternal(i)),
    active: data.active.nodes.filter((i) => !isInternal(i)),
  }
}

// --- Draft

export function buildDraft({ start, end, prs, done, active, hours, team, excludeIssues = [] }) {
  const excluded = new Set(excludeIssues)
  const shipped = prs.filter((pr) => {
    const ids = issueIdsIn(pr.title, team)
    return !ids.length || ids.some((id) => !excluded.has(id))
  })
  const shippedIds = new Set(shipped.flatMap((pr) => issueIdsIn(pr.title, team)))
  const otherDone = done.filter((i) => !shippedIds.has(i.identifier))

  const lines = [`Hi all — here's where Card Mania landed for **${formatRange(start, end)}**.`, '']

  lines.push('## Shipped to staging')
  if (shipped.length)
    for (const pr of shipped) lines.push(`- ${pr.title} ([#${pr.number}](${pr.url}))`)
  else lines.push('- _Nothing merged this week_')
  lines.push('')

  if (otherDone.length) {
    lines.push('## Also completed')
    for (const i of otherDone) lines.push(`- ${i.identifier}: ${i.title}`)
    lines.push('')
  }

  lines.push('## In progress')
  if (active.length) for (const i of active) lines.push(`- ${i.identifier}: ${i.title}`)
  else lines.push('- _TODO: what is being worked on_')
  lines.push('')

  lines.push('## Up next')
  lines.push('- _TODO_')
  lines.push('')

  if (hours) {
    lines.push('## Hours')
    lines.push(
      `- ${hours.week.toFixed(1)}h this week · ${hours.total.toFixed(1)}h total since ${formatShortDate(hours.since)}`
    )
    lines.push('')
  }

  lines.push('Questions or feedback welcome — reply here.')
  return lines.join('\n')
}

const formatShortDate = (key) =>
  parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function claude(args, opts) {
  const out = run('claude', ['-p', ...args, '--output-format', 'json'], opts)
  const result = JSON.parse(out)
  if (result.is_error) throw new Error(`claude: ${result.result}`)
  return result.result
}

function polish(body, config) {
  const prompt = `You are editing a weekly status update that a solo developer posts to their non-technical clients (the owners of the Card Mania trading-card app).

Rewrite the draft below in plain, friendly language a business owner understands:
- Keep the same Markdown structure and section headings. Merge closely related bullets; drop purely internal/technical chores (CI, refactors, type regeneration) unless they unblock something visible.
- Describe what changed for users, not how it was built. Keep Linear identifiers (e.g. ITS-98) and PR links where present.
- Keep the Hours section numbers exactly as written.
- Leave "_TODO_" placeholders in place for the developer to fill in. Never invent work that isn't in the draft.
- Output only the rewritten Markdown, with no preamble.

<draft>
${body}
</draft>`
  // Run outside the repo so this headless session isn't counted as work time or given repo tools
  return claude(['--model', config.status.aiModel, '--tools', ''], {
    cwd: OPS_DIR,
    input: prompt,
  }).trim()
}

function draftPath(weekStart) {
  return path.join(STATUS_DIR, `${weekStart}.md`)
}

function latestDraft() {
  if (!fs.existsSync(STATUS_DIR)) return null
  const files = fs
    .readdirSync(STATUS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
  return files.length ? path.join(STATUS_DIR, files.at(-1)) : null
}

function draft(flags, config) {
  const start = flags['week-of']
    ? mondayOf(resolveDay(flags['week-of']))
    : addDays(mondayOf(today()), -7)
  const endExclusive = addDays(start, 7)
  const end = addDays(start, 6)
  const file = draftPath(start)

  if (fs.existsSync(file) && !flags.force) {
    console.log(`Draft already exists (use --force to regenerate): ${file}`)
    if (flags.notify)
      notify('Card Mania weekly status', 'Draft ready — npm run status:edit, then status:send')
    return
  }

  const team = config.status.linearTeam
  const prs = mergedPullRequests(config, start, endExclusive)
  const { done, active } = linearIssues(config, start, endExclusive)

  let hours = null
  if (config.status.includeHours) {
    sync(config)
    const { days } = computeHours(config)
    hours = {
      week: sumHours(days, start, endExclusive),
      total: sumHours(days, config.scope.start, endExclusive),
      since: config.scope.start,
    }
  }

  const raw = buildDraft({
    start,
    end,
    prs,
    done,
    active,
    hours,
    team,
    excludeIssues: config.status.excludeIssues,
  })
  fs.mkdirSync(STATUS_DIR, { recursive: true })
  fs.writeFileSync(path.join(STATUS_DIR, `${start}.raw.md`), raw + '\n')

  let body = raw
  if (flags.ai) {
    try {
      body = polish(raw, config)
    } catch (err) {
      console.error(`AI polish failed, keeping the template draft: ${err.message}`)
    }
  }

  const meta = { subject: `Weekly update — ${formatRange(start, end)}`, week: start }
  fs.writeFileSync(file, serializeDraft(meta, body))
  console.log(`Draft written: ${file}`)
  console.log(
    `  ${prs.length} PRs merged · ${done.length} issues completed · ${active.length} in progress`
  )
  if (flags.notify) {
    notify('Card Mania weekly status', 'Draft ready — npm run status:edit, then status:send')
  }
}

function edit(flags) {
  const file = flags.file ?? latestDraft()
  if (!file) throw new Error('No drafts yet — run npm run status:draft')
  const editor = process.env.VISUAL || process.env.EDITOR
  if (editor) run('sh', ['-c', `${editor} "$1"`, 'sh', file], { stdio: 'inherit' })
  else run('open', ['-t', file])
}

async function send(flags, config) {
  const file = flags.file ?? latestDraft()
  if (!file) throw new Error('No drafts yet — run npm run status:draft')
  const { meta, body } = parseDraft(fs.readFileSync(file, 'utf8'))

  if (meta.posted && !flags.force) {
    console.log(`Already posted: ${meta.posted} (use --force to post again)`)
    return
  }
  if (/_TODO/.test(body)) {
    throw new Error(`Draft still has _TODO_ placeholders — run npm run status:edit first (${file})`)
  }

  const { basecamp } = config.status
  const payload = {
    board_id: basecamp.boardId,
    category_id: basecamp.categoryId,
    subject: meta.subject,
    content: mdToHtml(body),
    status: 'active',
  }

  console.log(`\n──── ${meta.subject} ────\n`)
  console.log(body.trim())
  console.log(
    `\n──── → Basecamp project ${basecamp.projectId}, message board ${basecamp.boardId} (Heartbeat) ────\n`
  )

  if (flags['dry-run']) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  if (!flags.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question('Post this to the client Basecamp? [y/N] ')
    rl.close()
    if (answer.trim().toLowerCase() !== 'y') {
      console.log('Not posted.')
      return
    }
  }

  const prompt = `Call the mcp__basecamp__create_message tool exactly once with exactly these arguments. Copy every value verbatim — do not rewrite, reformat, or summarize the content.

${JSON.stringify(payload, null, 2)}

After the tool succeeds, reply with only the created message's app_url and nothing else. If it fails, reply with "ERROR: " followed by the error.`

  // Runs in the repo because the Basecamp MCP server is configured at local (project) scope
  const result = claude(
    [
      '--model',
      config.status.aiModel,
      // No built-in tools; the only MCP tool that runs without a prompt is create_message
      '--tools',
      '',
      '--allowedTools',
      'mcp__basecamp__create_message',
    ],
    { cwd: REPO_ROOT, input: prompt }
  )
  const url = result.match(/https:\/\/app\.basecamp\.com\/\S+/)?.[0]
  if (!url)
    throw new Error(`Post may have failed — check Basecamp before retrying. Claude said: ${result}`)

  fs.writeFileSync(
    file,
    serializeDraft({ ...meta, posted: url, postedAt: new Date().toISOString() }, body)
  )
  console.log(`✅ Posted: ${url}`)
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { flags } = parseArgs(rest)
  const config = loadConfig()
  switch (command) {
    case 'draft':
      return draft(flags, config)
    case 'edit':
      return edit(flags)
    case 'send':
      return send(flags, config)
    default:
      console.error('Usage: status.mjs draft|edit|send — see the header of scripts/ops/status.mjs')
      process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
