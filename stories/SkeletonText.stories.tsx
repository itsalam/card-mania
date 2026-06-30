import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { SkeletonText } from '@/components/ui/text/skeleton-text'

const meta: Meta<typeof SkeletonText> = {
  title: 'UI/SkeletonText',
  component: SkeletonText,
  argTypes: {
    loading: { control: 'boolean' },
    variant: {
      control: 'select',
      options: ['default', 'small', 'muted', 'badge', 'h1', 'h2'],
    },
  },
  args: {
    loading: true,
    children: 'Charizard Base Set Holo Rare 1st Edition',
  },
}
export default meta
type Story = StoryObj<typeof SkeletonText>

export const Loading: Story = {
  args: { loading: true },
}

export const Loaded: Story = {
  args: { loading: false },
}

export const HeadingLoading: Story = {
  args: { loading: true, variant: 'h1', children: 'Card Name' },
}

export const MutedLoading: Story = {
  args: { loading: true, variant: 'muted', children: 'Pokémon • Base Set' },
}

export const CardDetailRows: Story = {
  render: () => (
    <View style={{ gap: 6 }}>
      <SkeletonText variant="h1" loading>
        Card Name
      </SkeletonText>
      <SkeletonText variant="muted" loading>
        Set Name
      </SkeletonText>
      <SkeletonText loading>$485.00</SkeletonText>
    </View>
  ),
}
