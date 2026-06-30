import type { Preview } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

// Initialise react-native-ui-lib color tokens so components that reference
// Colors.$backgroundDisabled etc. resolve at render time.
require('@/assets/rn-ui')

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i } },
  },
  decorators: [
    (Story) => (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#0f0f0f', padding: 16 }}>
          <Story />
        </View>
      </GestureHandlerRootView>
    ),
  ],
}

export default preview
