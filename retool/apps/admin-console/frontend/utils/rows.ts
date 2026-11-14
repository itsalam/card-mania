/** Normalizes an unknown RPC payload into a list of row objects. */
export function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord)
  if (isRecord(payload)) {
    // Some RPCs wrap their rows in a single array-valued field.
    for (const value of Object.values(payload)) {
      if (Array.isArray(value) && value.every(isRecord)) return value as Record<string, unknown>[]
    }
    return [payload]
  }
  return []
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Finds the user-id column on a member row without assuming a fixed schema. */
export function pickUserId(row: Record<string, unknown>): string | null {
  const candidates = ['user_id', 'userId', 'uid', 'id']
  for (const key of candidates) {
    const value = row[key]
    if (typeof value === 'string' && value.length > 0) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}
