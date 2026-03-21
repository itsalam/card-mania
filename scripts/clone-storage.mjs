// scripts/sync-storage-no-db.mjs
import { createClient } from '@supabase/supabase-js'

const {
  REMOTE_URL, // e.g. https://<project>.supabase.co
  REMOTE_SERVICE_ROLE, // service_role JWT
  LOCAL_URL = 'http://localhost:54321',
  LOCAL_SERVICE_ROLE, // local service_role JWT (from `supabase status`)               // comma-separated list, e.g. "avatars,card-images"
} = process.env

if (!REMOTE_URL || !REMOTE_SERVICE_ROLE || !LOCAL_SERVICE_ROLE) {
  throw new Error('Need REMOTE_URL, REMOTE_SERVICE_ROLE, LOCAL_SERVICE_ROLE')
}

async function listAllBuckets() {
  const r = await fetch(`https://zijgqgpwmqrgnzcictcb.supabase.co/storage/v1/bucket`, {
    headers: {
      Authorization: `Bearer ${REMOTE_SERVICE_ROLE}`,
      apikey: REMOTE_SERVICE_ROLE,
    },
  })
  return r.json()
}

const remoteStorageApi = `${REMOTE_URL}/storage/v1`
const local = createClient(LOCAL_URL, LOCAL_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const bucketData = await listAllBuckets()
console.log({ bucketData })
const buckets = bucketData
  .map((bd) => bd.id)
  .map((s) => s.trim())
  .filter(Boolean)

async function storageFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${REMOTE_SERVICE_ROLE}`,
      apikey: REMOTE_SERVICE_ROLE,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${url}\n${text}`)
  }
  return res
}

// Swagger: POST /object/list-v2/{bucketName} :contentReference[oaicite:5]{index=5}
async function listAllObjectsV2(bucket) {
  const out = []
  let cursor = null

  while (true) {
    const body = {
      prefix: '',
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    }

    const res = await storageFetch(
      `${remoteStorageApi}/object/list-v2/${encodeURIComponent(bucket)}`,
      { method: 'POST', body: JSON.stringify(body) }
    )

    const json = await res.json()

    // Response shape can vary slightly; handle common forms
    const items = json?.objects ?? json?.data?.objects ?? json?.data ?? json?.items ?? []

    for (const it of items) {
      // Swagger returns entries with a "name" for file path
      if (it?.name) out.push(it.name)
    }

    // cursor / next pagination key can differ; handle common forms
    const next =
      json?.nextCursor ?? json?.cursor ?? json?.data?.nextCursor ?? json?.data?.cursor ?? null

    // If API returns the same cursor or no next cursor, stop
    if (!next || next === cursor) break
    cursor = next
  }

  return out
}

// Public download URL format is documented. :contentReference[oaicite:6]{index=6}
async function downloadPublic(bucket, name) {
  const url = `${remoteStorageApi}/object/public/${encodeURIComponent(bucket)}/${encodeURI(name)}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Download failed ${res.status} for ${bucket}/${name}\n${text}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

async function uploadToLocal(bucket, name, bytes) {
  const { error } = await local.storage.from(bucket).upload(name, bytes, {
    upsert: true,
    contentType: 'application/octet-stream',
  })
  if (error) console.log(error)
}

for (const bucket of buckets) {
  console.log(`\n== Bucket: ${bucket} ==`)
  const names = await listAllObjectsV2(bucket)
  console.log(`Found ${names.length} objects`)

  let n = 0
  for (const name of names) {
    // Skip "folders" if returned
    if (name.endsWith('/')) continue

    const bytes = await downloadPublic(bucket, name)
    await uploadToLocal(bucket, name, bytes)

    n++
    if (n % 50 === 0) console.log(`Synced ${n}/${names.length}`)
  }

  console.log(`✅ Done bucket ${bucket}`)
}

console.log('\n✅ Storage sync complete.')
