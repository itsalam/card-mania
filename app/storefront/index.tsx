import { Text } from '@/components/ui/text/base-text'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export default function StorefrontIndexPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text variant="h3" style={{ marginBottom: 8 }}>
        CardMania Storefront
      </Text>
      <Text variant="muted" style={{ textAlign: 'center', color: Colors.$textNeutralHeavy }}>
        Enter a username in the URL:{' '}
        <Text variant="muted" style={{ fontFamily: 'monospace' }}>
          /storefront/[username]
        </Text>
      </Text>
    </View>
  )
}
