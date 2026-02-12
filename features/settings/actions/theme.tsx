import { Json } from '@/lib/store/supabase'
import { Appearance, ColorSchemeName } from 'react-native'
import { getFromPath } from '../helpers'

const adjustTheme = (root: Json) => {
  const preferenceTheme = getFromPath(root, ['general', 'theme'])
  const rnTheme = Appearance.getColorScheme()
  if (preferenceTheme instanceof String && preferenceTheme !== rnTheme) {
    Appearance.setColorScheme(preferenceTheme as ColorSchemeName)
  }
  return {
    hasUpdated: false,
  }
}

export default adjustTheme
