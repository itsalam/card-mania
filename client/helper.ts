import { getSupabase } from '@/lib/store/client'
import { FunctionInvokeOptions } from '@supabase/supabase-js'
import * as crypto from 'expo-crypto'
import { z } from 'zod'

export async function invokeFx<In extends FunctionInvokeOptions['body'], Out>(
  name: string,
  payload: In,
  options: {
    method?: 'GET' | 'POST'
    parseOut?: z.ZodType<Out> // optional Zod validation
    headers?: Record<string, string>
    useQueryParams?: boolean
  }
): Promise<{ data: Out; response?: Response; error?: Error }> {
  const { parseOut, headers, useQueryParams, method = 'GET' } = options
  let body = undefined
  let url = name
  let queryParams
  if (useQueryParams) {
    if (payload instanceof Object) {
      queryParams = new URLSearchParams(
        Object.entries(payload).map(([key, value]) => {
          if (value !== null && typeof value === 'object') {
            return [key, JSON.stringify(value)]
          }
          return [key, String(value)]
        })
      )
    } else if (payload instanceof URLSearchParams) {
      queryParams = payload
    } else if (typeof payload === 'string') {
      queryParams = new URLSearchParams(payload)
    } else {
      queryParams = new URLSearchParams()
    }
    url = `${name}?${queryParams.toString()}`
  } else {
    body = payload
  }

  let invokeBody: any = undefined
  let invokeHeaders: Record<string, string> = {
    'Idempotency-Key': crypto.randomUUID(),
    ...(headers ?? {}),
  }

  if (method === 'POST') {
    invokeHeaders['Content-Type'] ??= 'application/json'
    invokeBody =
      typeof body === 'string' || body instanceof URLSearchParams || body instanceof FormData
        ? body
        : JSON.stringify(body) // <— key change
  }

  const { data, error, response } = await getSupabase().functions.invoke(url, {
    body: invokeBody,
    method,
    headers: invokeHeaders,
  })
  return {
    data: parseOut ? parseOut.parse(data) : (data as Out),
    response: response,
    error: error,
  }
}
