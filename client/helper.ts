import { supabase } from '@/store/client';
import { FunctionInvokeOptions } from '@supabase/supabase-js';
import * as crypto from 'expo-crypto';
import { z } from 'zod';

export async function invokeFx<In extends FunctionInvokeOptions["body"], Out>(
  name: string,
  payload: In,
  options: {
    method?: 'GET' | 'POST',
    parseOut?: z.ZodType<Out>,             // optional Zod validation
    headers?: Record<string, string>,
    useQueryParams?: boolean
  }
): Promise<{data: Out, response?: Response, error?: Error}> {
  const { parseOut, headers, useQueryParams, method } = options;

  let url = name;
  let queryParams;
  if (useQueryParams) {

    if (payload instanceof Object) {
      queryParams = new URLSearchParams(Object.entries(payload).map(([key, value]) => {
        if (value !== null && typeof value === "object") {
          return [key, JSON.stringify(value)];
        }
        return [key, String(value)];

      }));
    } else if (payload instanceof URLSearchParams) {
      queryParams = payload;
    } else if (typeof payload === 'string') {
      queryParams = new URLSearchParams(payload);
    } else {
      queryParams = new URLSearchParams();
    }
    url = `${name}?${queryParams.toString()}`;
  }
  const { data, error, response } = await supabase.functions.invoke(url, {
    body: useQueryParams ? undefined : payload,
    method: method ?? 'GET',
    headers: { 'Idempotency-Key': crypto.randomUUID(), ...(headers ?? {}) },
  })

  return {data: parseOut ? parseOut.parse(data) : (data as Out), response: response, error: error}
}