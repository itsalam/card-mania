// Native Storybook entry point.
// Rendered by app/_layout.tsx when EXPO_PUBLIC_STORYBOOK=true.
import { getStorybookUI } from '@storybook/react-native'
import './storybook.requires'

const StorybookUIRoot = getStorybookUI({ shouldPersistSelection: true })
export default StorybookUIRoot
