import type { Meta, StoryObj } from '@storybook/react-native'
import { AlertCircle, CheckCircle, Info, Zap } from 'lucide-react-native'
import React from 'react'
import { View } from 'react-native'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] },
  },
  args: { variant: 'default' },
}
export default meta
type Story = StoryObj<typeof Alert>

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Price alerts are active for this card.</AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>
        Your card was declined. Please update your payment method.
      </AlertDescription>
    </Alert>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <Alert icon={Info}>
      <AlertTitle>New offer received</AlertTitle>
      <AlertDescription>Someone made an offer on your Charizard listing.</AlertDescription>
    </Alert>
  ),
}

export const WithDestructiveIcon: Story = {
  render: () => (
    <Alert variant="destructive" icon={AlertCircle}>
      <AlertTitle>Listing removed</AlertTitle>
      <AlertDescription>
        Your listing was removed for violating community guidelines.
      </AlertDescription>
    </Alert>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <Alert icon={Info}>
        <AlertTitle>Informational</AlertTitle>
        <AlertDescription>Your collection was synced 2 minutes ago.</AlertDescription>
      </Alert>
      <Alert icon={CheckCircle}>
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Offer accepted — check your transactions.</AlertDescription>
      </Alert>
      <Alert variant="destructive" icon={AlertCircle}>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load marketplace data. Pull to refresh.</AlertDescription>
      </Alert>
      <Alert icon={Zap}>
        <AlertTitle>Price spike</AlertTitle>
        <AlertDescription>Charizard Base Set jumped 18% in the last 24h.</AlertDescription>
      </Alert>
    </View>
  ),
}
