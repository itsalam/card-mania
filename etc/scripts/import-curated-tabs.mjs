#!/usr/bin/env node
// import-curated-tags.mjs
//
// Usage:
//   node import-curated-tags.mjs ./curated-tags.json
//   node import-curated-tags.mjs ./curated-tags.json --dry
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node import-curated-tags.mjs ./curated-tags.json
//
// Env:
//   SUPABASE_URL                     (required)
//   SUPABASE_SERVICE_ROLE_KEY        (recommended; has RLS bypass for admin RPCs)
//   or SUPABASE_ANON_KEY             (if your RPC is exposed to anon/authenticated)

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// ---- tiny arg parser
const args = process.argv.slice(2)
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log(`Usage:
  node import-curated-tags.mjs <path-to-json> [--chunk N] [--dry]

Examples:
  node import-curated-tags.mjs ./curated-tags.json
  node import-curated-tags.mjs ./curated-tags.json --chunk 200
  node import-curated-tags.mjs ./curated-tags.json --dry

Env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   (preferred)
  SUPABASE_ANON_KEY           (fallback)`)
  process.exit(0)
}

const fileArg = args.find((a) => !a.startsWith('-'))
const dryRun = args.includes('--dry')
const chunkSizeArg = (() => {
  const i = args.indexOf('--chunk')
  return i >= 0 ? parseInt(args[i + 1], 10) : NaN
})()
const CHUNK_SIZE = Number.isFinite(chunkSizeArg) && chunkSizeArg > 0 ? chunkSizeArg : 500

// ---- env
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'ERROR: SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) are required.'
  )
  process.exit(1)
}

// ---- load & parse JSON
function readJson(filePath) {
  const abs = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`)
  }
  const raw = fs.readFileSync(abs, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`Invalid JSON in ${abs}: ${e.message}`)
  }
}

// ---- validate payload shape
function validatePayload(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('Payload must be a JSON array.')
  }
  const issues = []
  payload.forEach((item, idx) => {
    if (typeof item !== 'object' || item === null) {
      issues.push(`Index ${idx}: item must be an object`)
      return
    }
    if (!item.name || typeof item.name !== 'string') {
      issues.push(`Index ${idx}: missing or invalid "name"`)
    }
    if (!item.slug || typeof item.slug !== 'string') {
      issues.push(`Index ${idx}: missing or invalid "slug"`)
    }
    if (item.curated_weight != null && typeof item.curated_weight !== 'number') {
      issues.push(`Index ${idx}: "curated_weight" must be a number`)
    }
    if (item.aliases && !Array.isArray(item.aliases)) {
      issues.push(`Index ${idx}: "aliases" must be an array of strings`)
    }
    if (item.categories && !Array.isArray(item.categories)) {
      issues.push(`Index ${idx}: "categories" must be an array of strings`)
    }
  })
  return issues
}

// ---- chunk helper
function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ---- main
;(async () => {
  try {
    const payload = readJson(fileArg)
    const issues = validatePayload(payload)
    if (issues.length) {
      console.error('Validation errors:')
      issues.forEach((i) => console.error(' -', i))
      process.exit(1)
    }

    console.log(`Loaded ${payload.length} curated tags from ${fileArg}.`)
    if (dryRun) {
      console.log('Dry run only. No changes will be written.')
      // Show a quick sample
      console.log('Sample:', JSON.stringify(payload.slice(0, Math.min(3, payload.length)), null, 2))
      process.exit(0)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })

    const chunks = chunkArray(payload, CHUNK_SIZE)
    let totalInserted = 0
    let totalUpdated = 0

    console.log(`Importing in ${chunks.length} chunk(s) of up to ${CHUNK_SIZE}…`)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      process.stdout.write(`  [${i + 1}/${chunks.length}] ${chunk.length} items… `)

      const { data, error } = await supabase.rpc('curated_tags_import', { payload: chunk })

      if (error) {
        console.error('\nRPC error on chunk', i + 1, ':', error.message)
        // Helpful diagnostics:
        if (error.details) console.error('details:', error.details)
        if (error.hint) console.error('hint:', error.hint)
        process.exit(1)
      }

      const inserted = Number(data?.inserted ?? 0)
      const updated = Number(data?.updated ?? 0)
      totalInserted += inserted
      totalUpdated += updated

      console.log(`ok (inserted: ${inserted}, updated: ${updated})`)
    }

    console.log('\nImport complete.')
    console.log(`Total inserted: ${totalInserted}`)
    console.log(`Total updated : ${totalUpdated}`)
  } catch (err) {
    console.error('Fatal:', err.message)
    process.exit(1)
  }
})()
