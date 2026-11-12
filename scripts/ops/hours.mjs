#!/usr/bin/env node
// Hours tracking for Card Mania (ITS-65).
//
// Tracked time is reconstructed from activity in this repo — interactive Claude Code sessions
// and your git commits — grouped into work sessions, plus any manual timer intervals.
// Manual `add` / `set` entries adjust or override a day. See scripts/ops/README.md.
//
// Usage:
//   npm run hours                      weekly report since trackingStart
//   npm run hours -- report --since 2026-10-01 --daily
//   npm run hours -- start "client call" / stop / status
//   npm run hours -- add today 1.5 "call with Tony"
//   npm run hours -- set 2026-11-03 4 "auto missed offline work"
//   npm run hours -- sync [--quiet]    (run by the Claude Code Stop hook)

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  appendJsonl,
  loadConfig,
  mondayOf,
  opsPath,
  parseArgs,
  readJson,
  readJsonl,
  REPO_ROOT,
  resolveDay,
  run,
  today,
  writeJson,
} from './lib.mjs'
import { applyLedger, buildSessions, mergeIntervals, minutesByDay } from './sessions.mjs'

const ACTIVITY = opsPath('activity.jsonl')
const LEDGER = opsPath('ledger.jsonl')
const TIMER = opsPath('timer.json')
const SYNC_STATE = opsPath('sync-state.json')

// --- Sync: copy activity timestamps into the durable activity log.
// Claude Code deletes transcripts after ~30 days and squash merges drop branch commits,
// so both are snapshotted here incrementally.

function mainRepoRoot() {
  try {
    const common = run('git', [
      '-C',
      REPO_ROOT,
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ]).trim()
    return path.dirname(common)
  } catch {
    return REPO_ROOT
  }
}

function transcriptDirs() {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  // Claude Code names project dirs after the cwd with non-alphanumerics replaced by '-';
  // worktrees under .claude/worktrees show up as `<prefix>--claude-worktrees-…`
  const prefix = mainRepoRoot().replace(/[^a-zA-Z0-9]/g, '-')
  if (!fs.existsSync(projectsDir)) return []
  return fs
    .readdirSync(projectsDir)
    .filter((d) => d === prefix || d.startsWith(`${prefix}--`))
    .map((d) => path.join(projectsDir, d))
}

function syncTranscripts(state) {
  const rows = []
  state.offsets ??= {}
  for (const dir of transcriptDirs()) {
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
      const file = path.join(dir, name)
      const size = fs.statSync(file).size
      let offset = state.offsets[file] ?? 0
      if (size < offset) offset = 0
      if (size === offset) continue

      const fd = fs.openSync(file, 'r')
      const buf = Buffer.alloc(size - offset)
      fs.readSync(fd, buf, 0, buf.length, offset)
      fs.closeSync(fd)

      // Only consume complete lines; a partially written last line is picked up next time
      const text = buf.toString('utf8')
      const lastNewline = text.lastIndexOf('\n')
      if (lastNewline === -1) continue
      state.offsets[file] = offset + Buffer.byteLength(text.slice(0, lastNewline + 1))

      const seenMinutes = new Set()
      for (const line of text.slice(0, lastNewline).split('\n')) {
        let entry
        try {
          entry = JSON.parse(line)
        } catch {
          continue
        }
        if (entry.type !== 'user' && entry.type !== 'assistant') continue
        // Headless `claude -p` runs (e.g. the status scripts themselves) aren't hands-on work
        if (entry.entrypoint && entry.entrypoint !== 'cli') continue
        const t = Date.parse(entry.timestamp)
        if (Number.isNaN(t)) continue
        const minute = `${entry.sessionId}|${Math.floor(t / 60_000)}`
        if (seenMinutes.has(minute)) continue
        seenMinutes.add(minute)
        rows.push({ t: new Date(t).toISOString(), src: 'claude', sid: entry.sessionId })
      }
    }
  }
  return rows
}

function syncGit(state, config) {
  const seen = new Set(state.gitSeen ?? [])
  const emails = new Set(config.authorEmails.map((e) => e.toLowerCase()))
  let log = ''
  try {
    log = run('git', [
      '-C',
      REPO_ROOT,
      'log',
      '--all',
      '--no-merges',
      `--since=${config.trackingStart}`,
      '--format=%H%x09%aI%x09%ae',
    ])
  } catch {
    return []
  }
  const rows = []
  for (const line of log.split('\n').filter(Boolean)) {
    const [hash, date, email] = line.split('\t')
    if (seen.has(hash) || !emails.has(email.toLowerCase())) continue
    seen.add(hash)
    rows.push({ t: new Date(date).toISOString(), src: 'git', hash })
  }
  state.gitSeen = [...seen]
  return rows
}

export function sync(config = loadConfig()) {
  const state = readJson(SYNC_STATE, {})
  const rows = [...syncTranscripts(state), ...syncGit(state, config)]
  appendJsonl(ACTIVITY, rows)
  writeJson(SYNC_STATE, state)
  return rows.length
}

// --- Computation

/**
 * @returns {{ days: Map<string, { tracked: number, adjust: number, override: number | null, total: number }>, ledger: object[] }}
 */
export function computeHours(config = loadConfig(), now = Date.now()) {
  const events = readJsonl(ACTIVITY)
    .map((e) => ({ t: Date.parse(e.t), src: e.src }))
    .filter((e) => !Number.isNaN(e.t))
  const ledger = readJsonl(LEDGER)
  const timer = readJson(TIMER, null)

  const intervals = [
    ...buildSessions(events, config.sessions),
    ...ledger
      .filter((e) => e.type === 'timer')
      .map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) })),
    ...(timer ? [{ start: Date.parse(timer.start), end: now }] : []),
  ]
  const days = applyLedger(minutesByDay(mergeIntervals(intervals)), ledger)
  for (const key of days.keys()) if (key < config.trackingStart) days.delete(key)
  return { days, ledger }
}

export function sumHours(days, from, toExclusive) {
  let total = 0
  for (const [key, d] of days) if (key >= from && key < toExclusive) total += d.total
  return total
}

// --- CLI

const h = (n) => `${n.toFixed(1)}h`
const signed = (n) => (n === 0 ? '' : `${n > 0 ? '+' : ''}${n.toFixed(1)}h`)

function report(flags, config) {
  const { days } = computeHours(config)
  const since = flags.since ? resolveDay(flags.since) : config.trackingStart
  const until = flags.until ? resolveDay(flags.until) : today()
  const inRange = [...days.entries()]
    .filter(([key]) => key >= since && key <= until)
    .sort(([a], [b]) => a.localeCompare(b))

  if (flags.json) {
    console.log(JSON.stringify({ since, until, days: Object.fromEntries(inRange) }, null, 2))
    return
  }

  const rows = new Map()
  for (const [key, d] of inRange) {
    const bucket = flags.daily ? key : mondayOf(key)
    const row = rows.get(bucket) ?? { tracked: 0, adjust: 0, total: 0, overridden: false }
    row.tracked += d.tracked
    row.adjust += d.total - d.tracked
    row.total += d.total
    row.overridden ||= d.override !== null
    rows.set(bucket, row)
  }

  console.log(`\nCard Mania hours  ${since} → ${until}\n`)
  console.log(
    `${(flags.daily ? 'Day' : 'Week of').padEnd(12)}${'Tracked'.padStart(9)}${'Adj'.padStart(9)}${'Total'.padStart(9)}`
  )
  let rangeTotal = 0
  for (const [key, row] of rows) {
    rangeTotal += row.total
    const mark = row.overridden ? ' *' : ''
    console.log(
      `${key.padEnd(12)}${h(row.tracked).padStart(9)}${signed(row.adjust).padStart(9)}${h(row.total).padStart(9)}${mark}`
    )
  }
  console.log(`${'Total'.padEnd(30)}${h(rangeTotal).padStart(9)}`)
  if ([...rows.values()].some((r) => r.overridden))
    console.log('  * includes a manual `set` override')

  const timer = readJson(TIMER, null)
  if (timer) console.log(`\n⏱  Timer running since ${new Date(timer.start).toLocaleString()}`)
  console.log()
}

function timerStart(note) {
  const existing = readJson(TIMER, null)
  if (existing) {
    console.log(`Timer already running since ${new Date(existing.start).toLocaleString()}`)
    return
  }
  writeJson(TIMER, { start: new Date().toISOString(), note })
  console.log('⏱  Timer started')
}

function timerStop() {
  const timer = readJson(TIMER, null)
  if (!timer) {
    console.log('No timer running')
    return
  }
  const end = new Date().toISOString()
  appendJsonl(LEDGER, [{ type: 'timer', start: timer.start, end, note: timer.note }])
  fs.rmSync(TIMER)
  console.log(`⏹  Logged ${h((Date.parse(end) - Date.parse(timer.start)) / 3_600_000)}`)
}

function parseNumber(value, label) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`Expected a number for ${label}, got "${value}"`)
  return n
}

function main() {
  const [command = 'report', ...rest] = process.argv.slice(2)
  const { positional, flags } = parseArgs(rest)
  const config = loadConfig()
  const note = (from) => positional.slice(from).join(' ') || undefined

  switch (command) {
    case 'sync': {
      const added = sync(config)
      if (!flags.quiet) console.log(`Synced ${added} activity events`)
      break
    }
    case 'report':
      sync(config)
      report(flags, config)
      break
    case 'start':
      timerStart(note(0))
      break
    case 'stop':
      timerStop()
      break
    case 'status': {
      const timer = readJson(TIMER, null)
      console.log(
        timer ? `⏱  Running since ${new Date(timer.start).toLocaleString()}` : 'No timer running'
      )
      break
    }
    case 'add':
    case 'set': {
      const date = resolveDay(positional[0])
      const hours = parseNumber(positional[1], 'hours')
      appendJsonl(LEDGER, [
        { type: command, date, hours, note: note(2), at: new Date().toISOString() },
      ])
      console.log(`${command === 'add' ? 'Added' : 'Set'} ${h(hours)} on ${date}`)
      break
    }
    default:
      console.error(`Unknown command "${command}". See the header of scripts/ops/hours.mjs.`)
      process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}
