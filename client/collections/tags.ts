import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { Database } from '@/lib/store/supabase'
import {
  keepPreviousData,
  QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

export type SuggestedTag = {
  category_names: string[]
  category_slugs: string[]
  category: string
  id: string
  name: string
  score: number
}

// type TagCategoryEntry = {
//     category_names: string[];
//     category_slugs: string[];
//     input_text: string;
//     tag_id: string;
//     tag_name: string;
//     tag_slug: string;
// }

export const suggestedTagsOptions = (args: { maxResults?: number; search?: string }) =>
  queryOptions({
    queryKey: qk.suggested(args),
    // TanStack v5 will pass { signal } here if the adapter supports it
    queryFn: async (): Promise<SuggestedTag[]> => {
      const { data, error } = await getSupabase().rpc('suggest_tags_v2', {
        max_results: args.maxResults ?? 8,
        q: (args.search ?? '').trim(),
      })
      if (error) throw error
      return data.map((r) => ({
        ...r,
        category: r.category_slugs?.[0] || 'general',
      }))
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

export function useSuggestedTags(opts?: {
  maxResults?: number
  search?: string // e.g. filter by card title (requires a title column in cards)
}) {
  const queryClient = useQueryClient()
  const maxResults = opts?.maxResults ?? 8
  const search = opts?.search?.trim() || ''

  const { data, ...queryRes } = useQuery({
    ...suggestedTagsOptions({ maxResults, search }),
    enabled: !!search, // keep hook idle when empty
  })

  useEffect(() => {
    if (!data || data.length === 0) return
    queryClient.setQueryData(CATEGORY_MAP_KEY, (prev?: Map<string, TagCategoryEntry>) => {
      const base = prev ?? new Map<string, TagCategoryEntry>()
      const next = new Map(base) // new reference to trigger subscribers
      for (const r of data) {
        const key = normalize(r.name)
        next.set(key, {
          input_text: r.name,
          category_names: r.category_names,
          category_slugs: r.category_slugs,
          tag_id: r.id,
          tag_name: r.name,
          tag_slug: key,
        })
      }
      return next
    })
  }, [data, queryClient])

  return { data, ...queryRes }
}

type TagCategoryEntry = Partial<
  Database['public']['Functions']['get_tag_categories']['Returns'][number]
>

export const CATEGORY_MAP_KEY = ['tag-category-map'] as const
const normalize = (s: string) => s.trim().toLowerCase()

export const populateTagOptions = (queryClient: QueryClient) =>
  queryOptions({
    queryKey: CATEGORY_MAP_KEY,
    // Query returns the current map from cache (or a fresh one).
    queryFn: async () =>
      queryClient.getQueryData<Map<string, TagCategoryEntry>>(CATEGORY_MAP_KEY) ??
      new Map<string, TagCategoryEntry>(),
    initialData: () =>
      queryClient.getQueryData<Map<string, TagCategoryEntry>>(CATEGORY_MAP_KEY) ??
      new Map<string, TagCategoryEntry>(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })

export function usePopulateTagCategory(tags: string[] = []) {
  const queryClient = useQueryClient()

  const { data: map = new Map<string, TagCategoryEntry>() } = useQuery({
    ...populateTagOptions(queryClient),
  })

  const normalized = useMemo(() => tags.map(normalize).filter(Boolean), [tags])
  const missing = useMemo(() => normalized.filter((k) => !map.has(k)), [normalized, map])

  const { data, isFetching, error } = useQuery({
    enabled: missing.length > 0,
    queryKey: ['tag-categories', ...missing],
    queryFn: async (): Promise<TagCategoryEntry[]> => {
      const { data, error } = await getSupabase().rpc('get_tag_categories', {
        tags: missing, // text[]
      })
      if (error) throw error
      return (data ?? []) as TagCategoryEntry[]
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  })

  useEffect(() => {
    if (!data || data.length === 0) return
    queryClient.setQueryData(CATEGORY_MAP_KEY, (prev?: Map<string, TagCategoryEntry>) => {
      const base = prev ?? new Map<string, TagCategoryEntry>()
      const next = new Map(base) // new reference to trigger subscribers
      for (const r of data) {
        const key = normalize(r.tag_name || r.tag_slug || r.input_text || '')
        next.set(key, r)
      }
      return next
    })
  }, [data, queryClient])

  const get = (label: string | undefined | null) => (label ? map.get(normalize(label)) : undefined)

  return { map, get, isFetching, error }
}
