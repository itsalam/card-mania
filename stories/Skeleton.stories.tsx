import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Skeleton, SkeletonView } from '@/components/ui/skeleton'

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
}
export default meta
type Story = StoryObj<typeof Skeleton>

export const SingleLine: Story = {
  render: () => <Skeleton style={{ width: 200, height: 16 }} />,
}

export const MultiLine: Story = {
  render: () => (
    <View style={{ gap: 8 }}>
      <Skeleton style={{ width: 220, height: 16 }} />
      <Skeleton style={{ width: 180, height: 16 }} />
      <Skeleton style={{ width: 200, height: 16 }} />
    </View>
  ),
}

export const CardPlaceholder: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton style={{ width: 60, height: 84, borderRadius: 8 }} />
      <View style={{ gap: 8, justifyContent: 'center' }}>
        <Skeleton style={{ width: 140, height: 14 }} />
        <Skeleton style={{ width: 100, height: 14 }} />
        <Skeleton style={{ width: 60, height: 20 }} />
      </View>
    </View>
  ),
}

export const ViewLoading: Story = {
  render: () => <SkeletonView loading style={{ width: 200, height: 100, borderRadius: 8 }} />,
}

export const ViewLoaded: Story = {
  render: () => (
    <SkeletonView loading={false}>
      <View style={{ width: 200, height: 100, backgroundColor: '#333', borderRadius: 8 }} />
    </SkeletonView>
  ),
}
