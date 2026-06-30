import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { CardListView } from '@/features/tcg-card-views/ListCard'

const MOCK_CARD = {
  id: 'abc-123',
  name: 'Charizard',
  set_name: 'Base Set',
  latest_price: 485,
  grades_prices: { psa10: 2200, psa9: 900, ungraded: 485 },
  genre: 'pokemon',
  front_id: null,
  back_id: null,
  search_vector: null,
  price_history: null,
  card_metadata: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as any

const MOCK_CARD_CHEAP = {
  ...MOCK_CARD,
  id: 'def-456',
  name: 'Bulbasaur',
  set_name: 'Base Set',
  latest_price: 12,
}

const meta: Meta<typeof CardListView> = {
  title: 'Cards/CardListItem',
  component: CardListView,
}
export default meta
type Story = StoryObj<typeof CardListView>

export const Default: Story = {
  render: () => (
    <View style={{ width: 360 }}>
      <CardListView item={MOCK_CARD} />
    </View>
  ),
}

export const Loading: Story = {
  render: () => (
    <View style={{ width: 360 }}>
      <CardListView item={null} />
    </View>
  ),
}

export const List: Story = {
  render: () => (
    <View style={{ width: 360, gap: 1 }}>
      <CardListView item={MOCK_CARD} />
      <CardListView item={MOCK_CARD_CHEAP} />
    </View>
  ),
}
