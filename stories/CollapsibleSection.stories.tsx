import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Text, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof CollapsibleSection> = {
  title: 'UI/CollapsibleSection',
  component: CollapsibleSection,
}
export default meta
type Story = StoryObj<typeof CollapsibleSection>

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: Colors.$textNeutral }}>{label}</Text>
      <Text style={{ color: Colors.$textDefault, fontWeight: '500' }}>{value}</Text>
    </View>
  )
}

export const Default: Story = {
  render: () => (
    <CollapsibleSection title="Card Details">
      <Row label="Set" value="Base Set" />
      <Row label="Number" value="4/102" />
      <Row label="Rarity" value="Holo Rare" />
      <Row label="Edition" value="1st Edition" />
    </CollapsibleSection>
  ),
}

export const DefaultCollapsed: Story = {
  render: () => (
    <CollapsibleSection title="Price History" defaultCollapsed>
      <Row label="52W High" value="$62,000" />
      <Row label="52W Low" value="$31,500" />
      <Row label="Avg (90D)" value="$48,200" />
    </CollapsibleSection>
  ),
}

export const WithRightElement: Story = {
  render: () => (
    <CollapsibleSection
      title="Active Listings"
      rightElement={
        <Button size="sm" variant="outline">
          Add
        </Button>
      }
    >
      <Row label="PSA 10" value="$52,000" />
      <Row label="PSA 9" value="$18,000" />
      <Row label="Ungraded" value="$9,500" />
    </CollapsibleSection>
  ),
}

export const Stacked: Story = {
  render: () => (
    <View>
      <CollapsibleSection title="Card Details">
        <Row label="Set" value="Base Set" />
        <Row label="Number" value="4/102" />
      </CollapsibleSection>
      <CollapsibleSection title="Grade Breakdown" defaultCollapsed>
        <Row label="PSA 10" value="$52,000" />
        <Row label="PSA 9" value="$18,000" />
      </CollapsibleSection>
      <CollapsibleSection title="Recent Sales" defaultCollapsed>
        <Row label="Jun 28" value="$48,500" />
        <Row label="Jun 14" value="$47,200" />
      </CollapsibleSection>
    </View>
  ),
}
