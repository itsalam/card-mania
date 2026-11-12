# Ops: hours tracking + weekly status (ITS-63)

Internal tooling only. All data — activity log, manual entries, payments, drafts — lives in
`~/.card-mania-ops/` (override with `CARD_MANIA_OPS_DIR`), never in the repo.

## Setup (once per machine)

```sh
npm run ops:install          # config, Claude Code Stop hook, Monday launchd job
npm run ops:install -- --uninstall
```

Edit `~/.card-mania-ops/config.json` to change author emails, scope figures, session tuning,
excluded Linear issues, or the schedule (re-run `ops:install` after changing the schedule).

## Hours (ITS-65)

Tracked time = work sessions reconstructed from activity in this repo, unioned with timer intervals:

- **Claude Code** — interactive session timestamps (headless `claude -p` runs are excluded). The
  Stop hook copies them into `activity.jsonl` because Claude Code deletes transcripts after ~30 days.
- **Git** — your commit author times across all branches (snapshotted, so squash-merged branches
  still count).
- A gap over `idleGapMin` (30) starts a new session; each session gets a `leadInMin` (10) credit
  before its first event, or `gitOnlyLeadInMin` (45) when it's commits only.

Work that leaves no trace (device testing, calls, editor-only time) needs a manual entry:

```sh
npm run hours                                   # weekly report + scope/payments summary
npm run hours -- report --since 2026-10-01 --daily
npm run hours -- start "device QA" / stop / status
npm run hours -- add today 1.5 "call with Tony"     # added on top of tracked time
npm run hours -- set 2026-11-03 4 "offline work"    # replaces tracked time for that day
npm run hours -- paid 2026-05-05 1600 "e-transfer"
```

History before the hook was installed is estimated from commits alone, so treat it as a floor.

## Weekly status (ITS-66)

1. **Monday 8:30** — launchd runs `status:draft --ai --notify`: merged PRs into `staging`, Linear
   issues completed/in progress (ITS-63 and its sub-issues excluded), and hours for the past Mon–Sun
   week, rewritten for the client by `claude -p`. Saved to `~/.card-mania-ops/status/<monday>.md`.
   If the Mac is asleep at 8:30 it runs on wake.
2. `npm run status:edit` — fill in the `_TODO_` sections, trim anything internal.
3. `npm run status:send` — previews, asks y/N, posts to the ShabowBX Basecamp message board as a
   Heartbeat. Refuses while `_TODO_` remains or if the draft was already posted. `--dry-run` prints
   the payload.

Posting goes through `claude -p` with only `mcp__basecamp__create_message` allowed, using the Basecamp
MCP connection already authorized for this repo. Logs: `~/.card-mania-ops/logs/weekly-status.log`.

```sh
npm run test:ops
```
