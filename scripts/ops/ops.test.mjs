import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, mondayOf } from './lib.mjs'
import { mdToHtml } from './md-to-html.mjs'
import { applyLedger, buildSessions, mergeIntervals, minutesByDay } from './sessions.mjs'
import { buildDraft, issueIdsIn, parseDraft, serializeDraft } from './status.mjs'

const at = (h, m = 0, day = 3) => new Date(2026, 10, day, h, m).getTime()
const cfg = { idleGapMin: 30, leadInMin: 10, gitOnlyLeadInMin: 45 }

test('buildSessions splits on idle gaps and credits a lead-in', () => {
  const sessions = buildSessions(
    [
      { t: at(9, 0), src: 'claude' },
      { t: at(9, 20), src: 'claude' },
      { t: at(9, 45), src: 'git' },
      { t: at(11, 0), src: 'claude' },
    ],
    cfg
  )
  assert.equal(sessions.length, 2)
  assert.equal(sessions[0].start, at(8, 50))
  assert.equal(sessions[0].end, at(9, 45))
  assert.deepEqual(sessions[0].sources.sort(), ['claude', 'git'])
  assert.equal(sessions[1].start, at(10, 50))
})

test('git-only sessions get the longer lead-in', () => {
  const [s] = buildSessions([{ t: at(14, 0), src: 'git' }], cfg)
  assert.equal(s.start, at(13, 15))
})

test('mergeIntervals unions overlaps so timer + activity are not double counted', () => {
  const merged = mergeIntervals([
    { start: at(9), end: at(10) },
    { start: at(9, 30), end: at(11) },
    { start: at(12), end: at(13) },
  ])
  assert.deepEqual(merged, [
    { start: at(9), end: at(11) },
    { start: at(12), end: at(13) },
  ])
})

test('minutesByDay splits at local midnight', () => {
  const minutes = minutesByDay([{ start: at(23, 0, 3), end: at(1, 30, 4) }])
  assert.equal(minutes.get('2026-11-03'), 60)
  assert.equal(minutes.get('2026-11-04'), 90)
})

test('applyLedger: set overrides tracked, add stacks on top', () => {
  const days = applyLedger(
    new Map([
      ['2026-11-03', 120],
      ['2026-11-04', 60],
    ]),
    [
      { type: 'set', date: '2026-11-03', hours: 5 },
      { type: 'add', date: '2026-11-03', hours: 1 },
      { type: 'add', date: '2026-11-05', hours: 0.5 },
    ]
  )
  assert.equal(days.get('2026-11-03').total, 6)
  assert.equal(days.get('2026-11-04').total, 1)
  assert.equal(days.get('2026-11-05').total, 0.5)
})

test('week helpers', () => {
  assert.equal(mondayOf('2026-11-09'), '2026-11-09')
  assert.equal(mondayOf('2026-11-08'), '2026-11-02')
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
})

test('issueIdsIn expands slash-joined identifiers', () => {
  assert.deepEqual(issueIdsIn('ITS-60/61/62: Expo push notifications', 'ITS'), [
    'ITS-60',
    'ITS-61',
    'ITS-62',
  ])
  assert.deepEqual(issueIdsIn('Full-width ticker tape', 'ITS'), [])
})

test('buildDraft dedupes issues already shipped via a PR', () => {
  const body = buildDraft({
    start: '2026-11-02',
    end: '2026-11-08',
    team: 'ITS',
    prs: [{ number: 45, title: 'ITS-60/61: push', url: 'https://github.com/x/pull/45' }],
    done: [
      { identifier: 'ITS-60', title: 'Push A' },
      { identifier: 'ITS-99', title: 'Other' },
    ],
    active: [],
    hours: { week: 12.25, total: 140, since: '2026-01-30' },
  })
  assert.match(body, /ITS-60\/61: push \(\[#45\]/)
  assert.doesNotMatch(body, /Push A/)
  assert.match(body, /ITS-99: Other/)
  assert.match(body, /12\.3h this week · 140\.0h total/)
})

test('draft frontmatter round-trips', () => {
  const text = serializeDraft({ subject: 'Weekly update — Nov 2–8', week: '2026-11-02' }, 'Body')
  assert.deepEqual(parseDraft(text), {
    meta: { subject: 'Weekly update — Nov 2–8', week: '2026-11-02' },
    body: '\nBody\n',
  })
})

test('mdToHtml produces Basecamp-safe rich text', () => {
  const html = mdToHtml(
    [
      'Hi **all** — <update>',
      '',
      '## Shipped',
      '- Push notifications ([#45](https://github.com/x/pull/45))',
      '  - iOS',
      '- snake_case_name stays',
      '',
      'Thanks',
    ].join('\n')
  )
  assert.equal(
    html,
    '<div>Hi <strong>all</strong> — &lt;update&gt;</div>' +
      '<h1>Shipped</h1>' +
      '<ul><li>Push notifications (<a href="https://github.com/x/pull/45">#45</a>)' +
      '<ul><li>iOS</li></ul>' +
      '</li><li>snake_case_name stays</li></ul>' +
      '<div>Thanks</div>'
  )
})
