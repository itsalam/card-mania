import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { TabRow } from '@/components/tabs/TabRow'

const meta: Meta<typeof TabRow> = {
  title: 'UI/TabRow',
  component: TabRow,
}
export default meta
type Story = StoryObj<typeof TabRow>

export const TwoOptions: Story = {
  render: () => (
    <TabRow
      options={[
        { value: 'chart', label: 'Chart' },
        { value: 'sales', label: 'Sales' },
      ]}
    />
  ),
}

export const ThreeOptions: Story = {
  render: () => (
    <TabRow
      options={[
        { value: '1d', label: '1D' },
        { value: '1w', label: '1W' },
        { value: '1m', label: '1M' },
      ]}
      startingIdx={1}
    />
  ),
}

export const FourOptions: Story = {
  render: () => (
    <TabRow
      options={[
        { value: '1d', label: '1D' },
        { value: '1w', label: '1W' },
        { value: '1m', label: '1M' },
        { value: '1y', label: '1Y' },
      ]}
    />
  ),
}

export const WithCallback: Story = {
  render: () => (
    <View style={{ gap: 16 }}>
      <TabRow
        options={[
          { value: 'buy', label: 'Buy' },
          { value: 'sell', label: 'Sell' },
        ]}
        onValueChange={(v) => console.log('[TabRow] selected:', v)}
      />
    </View>
  ),
}
