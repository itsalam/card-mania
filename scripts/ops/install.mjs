#!/usr/bin/env node
// One-time setup for the ops tooling on this Mac (idempotent; re-run after changing the schedule).
//   1. Creates ~/.card-mania-ops/config.json with defaults
//   2. Adds a Claude Code Stop hook to .claude/settings.local.json (personal, gitignored) that
//      snapshots session activity for hours tracking
//   3. Installs a launchd agent that drafts the weekly status every Monday morning
//
// Usage: npm run ops:install [-- --uninstall]

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  DEFAULT_CONFIG,
  loadConfig,
  OPS_DIR,
  opsPath,
  parseArgs,
  readJson,
  REPO_ROOT,
  run,
  writeJson,
} from './lib.mjs'
import { sync } from './hours.mjs'

const LABEL = 'dev.cardmania.weekly-status'
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)
const SETTINGS = path.join(REPO_ROOT, '.claude', 'settings.local.json')
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/scripts/ops/hours.mjs" sync --quiet'

function installHook() {
  const settings = readJson(SETTINGS, {})
  settings.hooks ??= {}
  settings.hooks.Stop ??= []
  const present = settings.hooks.Stop.some((group) =>
    group.hooks?.some((hook) => hook.command?.includes('scripts/ops/hours.mjs'))
  )
  if (present) return console.log('✓ Claude Code Stop hook already installed')
  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: HOOK_COMMAND }] })
  writeJson(SETTINGS, settings)
  console.log(`✓ Added Claude Code Stop hook to ${path.relative(REPO_ROOT, SETTINGS)}`)
}

function uninstallHook() {
  const settings = readJson(SETTINGS, null)
  if (!settings?.hooks?.Stop) return
  settings.hooks.Stop = settings.hooks.Stop.filter(
    (group) => !group.hooks?.some((hook) => hook.command?.includes('scripts/ops/hours.mjs'))
  )
  if (!settings.hooks.Stop.length) delete settings.hooks.Stop
  if (!Object.keys(settings.hooks).length) delete settings.hooks
  writeJson(SETTINGS, settings)
  console.log('✓ Removed Claude Code Stop hook')
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function plist({ weekday, hour, minute }) {
  const log = opsPath('logs', 'weekly-status.log')
  // Login shell so gh / linear / claude resolve from the user's PATH
  const command = `cd ${JSON.stringify(REPO_ROOT)} && echo "--- $(date)" && node scripts/ops/status.mjs draft --ai --notify`
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${xml(command)}</string>
  </array>
  <!-- If the Mac is asleep at this time, launchd runs the job on wake -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>${weekday}</integer>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${xml(log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(log)}</string>
</dict>
</plist>
`
}

const domain = () => `gui/${process.getuid()}`

function unloadAgent() {
  try {
    run('launchctl', ['bootout', domain(), PLIST], { stdio: 'ignore' })
  } catch {
    // Not loaded
  }
}

function installAgent(schedule) {
  fs.mkdirSync(opsPath('logs'), { recursive: true })
  fs.mkdirSync(path.dirname(PLIST), { recursive: true })
  fs.writeFileSync(PLIST, plist(schedule))
  unloadAgent()
  run('launchctl', ['bootstrap', domain(), PLIST])
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const time = `${schedule.hour}:${String(schedule.minute).padStart(2, '0')}`
  console.log(`✓ Weekly status draft scheduled for ${days[schedule.weekday]} ${time} (${LABEL})`)
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2))

  if (flags.uninstall) {
    unloadAgent()
    fs.rmSync(PLIST, { force: true })
    console.log('✓ Removed launchd agent')
    uninstallHook()
    console.log(`Data left in place: ${OPS_DIR}`)
    return
  }

  const configFile = opsPath('config.json')
  if (!fs.existsSync(configFile)) {
    writeJson(configFile, DEFAULT_CONFIG)
    console.log(`✓ Wrote default config: ${configFile}`)
  } else {
    console.log(`✓ Config exists: ${configFile}`)
  }

  const config = loadConfig()
  installHook()
  if (process.platform === 'darwin') installAgent(config.status.schedule)
  else console.log('Skipping launchd agent (macOS only)')

  console.log(`✓ Initial sync: ${sync(config)} activity events captured`)
}

main()
