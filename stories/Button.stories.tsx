import type { Meta, StoryObj } from '@storybook/react-native'
import { Plus } from 'lucide-react-native'
import React from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
  args: { variant: 'default', size: 'default' },
}
export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  render: (args) => <Button {...args}>Buy Now</Button>,
}

export const AllVariants: Story = {
  render: () => (
    <View style={{ gap: 10 }}>
      {(
        ['default', 'primary', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
      ).map((variant) => (
        <Button key={variant} variant={variant}>
          {variant.charAt(0).toUpperCase() + variant.slice(1)}
        </Button>
      ))}
    </View>
  ),
}

export const Sizes: Story = {
  render: () => (
    <View style={{ gap: 10, alignItems: 'flex-start' }}>
      <Button size="lg">Large</Button>
      <Button size="default">Default</Button>
      <Button size="sm">Small</Button>
      <Button size="icon">
        <Plus size={20} color="white" />
      </Button>
    </View>
  ),
}

export const Disabled: Story = {
  render: () => (
    <View style={{ gap: 10 }}>
      <Button disabled>Disabled Default</Button>
      <Button variant="primary" disabled>
        Disabled Primary
      </Button>
      <Button variant="outline" disabled>
        Disabled Outline
      </Button>
    </View>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <View style={{ gap: 10 }}>
      <Button variant="primary">
        <Plus size={16} color="white" />
        Add to Cart
      </Button>
      <Button variant="outline">
        <Plus size={16} color="white" />
        Add to Wishlist
      </Button>
    </View>
  ),
}
