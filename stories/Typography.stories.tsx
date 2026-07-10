import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text/base-text'

const meta: Meta<typeof Text> = {
  title: 'UI/Typography',
  component: Text,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'h1',
        'h2',
        'h3',
        'h4',
        'p',
        'lead',
        'large',
        'small',
        'muted',
        'info',
        'badge',
        'stats',
      ],
    },
  },
  args: { variant: 'default', children: 'The quick brown fox' },
}
export default meta
type Story = StoryObj<typeof Text>

export const Playground: Story = {}

export const AllVariants: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      {(
        [
          ['h1', 'Heading 1'],
          ['h2', 'Heading 2'],
          ['h3', 'Heading 3'],
          ['h4', 'Heading 4'],
          ['large', 'Large — card name'],
          ['default', 'Default — body copy'],
          ['p', 'Paragraph — longer body text'],
          ['muted', 'Muted — secondary info'],
          ['small', 'Small — caption'],
          ['lead', 'Lead — introductory text'],
          ['badge', 'Badge — PSA 10'],
          ['info', 'INFO — metadata label'],
          ['stats', 'STATS — $485.00'],
        ] as const
      ).map(([variant, label]) => (
        <Text key={variant} variant={variant}>
          {label}
        </Text>
      ))}
    </View>
  ),
}

export const CardDetailLayout: Story = {
  render: () => (
    <View style={{ gap: 4 }}>
      <Text variant="info">Pokémon • Base Set</Text>
      <Text variant="h3">Charizard Holo Rare 1st Edition</Text>
      <Text variant="muted">Shadowless • 4/102</Text>
      <Text variant="h2">$48,500</Text>
      <Text variant="small">Last sale: 3 days ago</Text>
    </View>
  ),
}

export const PriceStats: Story = {
  render: () => (
    <View style={{ gap: 8 }}>
      <Text variant="stats">52-WEEK HIGH</Text>
      <Text variant="h3">$62,000</Text>
      <Text variant="stats">52-WEEK LOW</Text>
      <Text variant="h3">$31,500</Text>
      <Text variant="stats">AVG SALE (90D)</Text>
      <Text variant="h3">$48,200</Text>
    </View>
  ),
}
