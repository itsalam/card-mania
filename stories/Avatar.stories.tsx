import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
  },
  args: { size: 'md' },
}
export default meta
type Story = StoryObj<typeof Avatar>

export const WithFallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>
        <AvatarFallbackText>VL</AvatarFallbackText>
      </AvatarFallback>
    </Avatar>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
        <Avatar key={size} size={size}>
          <AvatarFallback>
            <AvatarFallbackText>{size.toUpperCase()}</AvatarFallbackText>
          </AvatarFallback>
        </Avatar>
      ))}
    </View>
  ),
}

export const WithImage: Story = {
  render: () => (
    <Avatar size="lg">
      <AvatarImage source={{ uri: 'https://i.pravatar.cc/150?img=3' }} />
      <AvatarFallback>
        <AvatarFallbackText>JD</AvatarFallbackText>
      </AvatarFallback>
    </Avatar>
  ),
}

export const AvatarGroup: Story = {
  render: () => (
    <View style={{ flexDirection: 'row' }}>
      {['AB', 'CD', 'EF', 'GH'].map((initials, i) => (
        <Avatar key={initials} size="md" style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i }}>
          <AvatarFallback>
            <AvatarFallbackText>{initials}</AvatarFallbackText>
          </AvatarFallback>
        </Avatar>
      ))}
    </View>
  ),
}
