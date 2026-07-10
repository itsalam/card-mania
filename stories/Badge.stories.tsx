import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Badge, Chip } from '@/components/ui/badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  argTypes: {
    variant: { control: 'select', options: ['default', 'square'] },
    label: { control: 'text' },
  },
  args: { label: 'PSA 10', variant: 'default' },
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {}

export const Square: Story = {
  args: { variant: 'square', label: 'Pending' },
}

export const GradeChips: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {['PSA 10', 'PSA 9', 'BGS 9.5', 'CGC 8', 'Raw'].map((grade) => (
        <Badge key={grade} label={grade} variant="default" />
      ))}
    </View>
  ),
}

export const OfferStatuses: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {['Pending', 'Accepted', 'Declined', 'Cancelled', 'Completed'].map((status) => (
        <Badge key={status} label={status} variant="square" />
      ))}
    </View>
  ),
}

export const ChipVariant: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Chip label="Pokémon" />
      <Chip label="Holo" />
      <Chip label="1st Edition" />
    </View>
  ),
}
