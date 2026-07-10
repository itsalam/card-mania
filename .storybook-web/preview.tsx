import type { Preview } from '@storybook/react'
import React from 'react'
import '../global.css'

// Initialise react-native-ui-lib color tokens (works via react-native-web)
import '@/assets/rn-ui'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i } },
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          padding: 16,
          backgroundColor: '#0f0f0f',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default preview
