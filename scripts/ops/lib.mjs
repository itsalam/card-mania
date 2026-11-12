// Shared helpers for the ops scripts (hours tracking + weekly status, ITS-63).
// All data lives outside the repo in OPS_DIR so billing data never gets committed.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const OPS_DIR = process.env.CARD_MANIA_OPS_DIR ?? path.join(os.homedir(), '.card-mania-ops')

export const opsPath = (...parts) => path.join(OPS_DIR, ...parts)

export const DEFAULT_CONFIG = {
  authorEmails: ['vincentthanhlam@gmail.com'],
  // Initial commercial scope (Jan 30 meeting notes, ITS-65)
  scope: { start: '2026-01-30', starterFee: 600, budget: 1600, minHours: 60, maxHours: 80 },
  sessions: {
    // A gap longer than this between activity events starts a new work session
    idleGapMin: 30,
    // Time credited before the first event of a session (reading, thinking, setup)
    leadInMin: 10,
    // Commits alone are a sparse signal, so git-only sessions get a longer lead-in
    gitOnlyLeadInMin: 45,
  },
  status: {
    github: { repo: 'itsalam/card-mania', baseBranches: ['staging'] },
    linearTeam: 'ITS',
    // Internal-only issues (and their sub-issues) never appear in client posts
    excludeIssues: ['ITS-63'],
    includeHours: true,
    aiModel: 'sonnet',
    schedule: { weekday: 1, hour: 8, minute: 30 },
    basecamp: { projectId: 49386814, boardId: 10444782813, categoryId: 116835301 },
  },
}

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v)

function deepMerge(base, override) {
  const out = { ...base }
  for (const [k, v] of Object.entries(override ?? {})) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v
  }
  return out
}

export function loadConfig() {
  return deepMerge(DEFAULT_CONFIG, readJson(opsPath('config.json'), {}))
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

export function readJsonl(file) {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

export function appendJsonl(file, rows) {
  if (!rows.length) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
}

// --- Local-time day keys (YYYY-MM-DD). Everything is bucketed in the machine's timezone.

const pad = (n) => String(n).padStart(2, '0')

export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, n) {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

export function mondayOf(key) {
  const d = parseDay(key)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d)
}

export const today = () => dayKey(new Date())

export function resolveDay(input) {
  if (!input || input === 'today') return today()
  if (input === 'yesterday') return addDays(today(), -1)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error(`Expected YYYY-MM-DD, got "${input}"`)
  return input
}

export function formatRange(startKey, endKey) {
  const fmt = (key, opts) => parseDay(key).toLocaleDateString('en-US', opts)
  const sameMonth = startKey.slice(0, 7) === endKey.slice(0, 7)
  return `${fmt(startKey, { month: 'short', day: 'numeric' })}–${fmt(
    endKey,
    sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }
  )}`
}

// --- Tiny argv parser: positional args plus --flag / --key value

export function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const [key, inline] = arg.slice(2).split('=')
    if (inline !== undefined) flags[key] = inline
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[key] = argv[++i]
    else flags[key] = true
  }
  return { positional, flags }
}

export function notify(title, message) {
  if (process.platform !== 'darwin') return
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  try {
    run('osascript', [
      '-e',
      `display notification "${esc(message)}" with title "${esc(title)}" sound name "Glass"`,
    ])
  } catch {
    // Notifications are best-effort
  }
}
