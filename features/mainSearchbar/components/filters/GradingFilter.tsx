import { ToggleBadge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { ScrollView, View } from 'react-native'
import { useFilters } from './providers'

// Stored values are the slugs search_storefront_items expects in p_grading —
// grading-company slugs plus the literal 'raw' (ci.grade_condition_id IS NULL).
const GRADING_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'psa', label: 'PSA' },
  { slug: 'bgs', label: 'BGS' },
  { slug: 'cgc', label: 'CGC' },
  { slug: 'tag', label: 'TAG' },
  { slug: 'ace', label: 'ACE' },
  { slug: 'raw', label: 'Raw' },
]

/**
 * ITS-91 grading multi-select (filter sheet). Only narrows results in the
 * marketplace scope (search_storefront_items); the catalog RPC has no grading.
 */
export function GradingFilter() {
  const { grading, toggleGrading } = useFilters()

  return (
    <View className="flex flex-row gap-2 items-center">
      <Text className="text-lg font-medium">Grading</Text>
      <Separator orientation="vertical" />
      <ScrollView horizontal>
        <View className="flex-row gap-2">
          {GRADING_OPTIONS.map(({ slug, label }) => (
            <ToggleBadge
              key={slug}
              label={label}
              checked={grading.includes(slug)}
              onCheckedChange={() => toggleGrading(slug)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
