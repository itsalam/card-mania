import type { Meta, StoryObj } from '@storybook/react-native'
import { Archive, Bell, Heart, Star } from 'lucide-react-native'
import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import {
  Tabs,
  TabsContent,
  TabsLabel,
  TabsList,
  TabsScrollList,
  TabsTrigger,
} from '@/components/ui/tabs'

const meta: Meta = {
  title: 'UI/Tabs',
}
export default meta
type Story = StoryObj

function PillTabsDemo({ tabs }: { tabs: { value: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0].value)
  return (
    <View style={{ gap: 16 }}>
      <Tabs value={active} onValueChange={setActive}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <TabsLabel value={t.value} label={t.label} />
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <View style={{ padding: 16 }}>
              <Text style={{ color: Colors.$textDefault }}>{t.label} content</Text>
            </View>
          </TabsContent>
        ))}
      </Tabs>
    </View>
  )
}

export const TwoTabs: Story = {
  render: () => (
    <PillTabsDemo
      tabs={[
        { value: 'vault', label: 'Vault' },
        { value: 'wishlist', label: 'Wishlist' },
      ]}
    />
  ),
}

export const ThreeTabs: Story = {
  render: () => (
    <PillTabsDemo
      tabs={[
        { value: 'vault', label: 'Vault' },
        { value: 'wishlist', label: 'Wishlist' },
        { value: 'selling', label: 'Selling' },
      ]}
    />
  ),
}

function WithIconsDemo() {
  const [active, setActive] = useState('vault')
  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsList>
        <TabsTrigger value="vault">
          <TabsLabel value="vault" label="Vault" iconLeft={Archive} />
        </TabsTrigger>
        <TabsTrigger value="wishlist">
          <TabsLabel value="wishlist" label="Wishlist" iconLeft={Heart} />
        </TabsTrigger>
        <TabsTrigger value="alerts">
          <TabsLabel value="alerts" label="Alerts" iconLeft={Bell} />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export const WithIcons: Story = {
  render: () => <WithIconsDemo />,
}

function ScrollableTabsDemo() {
  const tabs = ['All', 'Pokémon', 'Magic', 'Yu-Gi-Oh', 'Baseball', 'Basketball', 'Football']
  const [active, setActive] = useState('All')
  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsScrollList masked style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
        {tabs.map((t) => (
          <TabsTrigger key={t} value={t}>
            <TabsLabel value={t} label={t} />
          </TabsTrigger>
        ))}
      </TabsScrollList>
    </Tabs>
  )
}

export const ScrollableTabs: Story = {
  render: () => <ScrollableTabsDemo />,
}

function FourTabsWithStarDemo() {
  const [active, setActive] = useState('chart')
  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsList>
        <TabsTrigger value="chart">
          <TabsLabel value="chart" label="Chart" />
        </TabsTrigger>
        <TabsTrigger value="sales">
          <TabsLabel value="sales" label="Sales" />
        </TabsTrigger>
        <TabsTrigger value="offers">
          <TabsLabel value="offers" label="Offers" />
        </TabsTrigger>
        <TabsTrigger value="saved">
          <TabsLabel value="saved" label="Saved" iconRight={Star} />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export const FourTabsWithStar: Story = {
  render: () => <FourTabsWithStarDemo />,
}
