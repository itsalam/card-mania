import type { Preview } from '@storybook/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Colors } from 'react-native-ui-lib'
import { StoreProvider } from '@/lib/store/provider'

require('@/assets/rn-ui')
// Runs Colors.supportDarkMode() + Colors.loadSchemes() as module-level side effects
require('@/components/ui/theme')
Colors.setScheme('dark')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i } },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <StoreProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: '#0f0f0f', padding: 16 }}>
              <Story />
            </View>
          </GestureHandlerRootView>
        </StoreProvider>
      </QueryClientProvider>
    ),
  ],
}

export default preview
