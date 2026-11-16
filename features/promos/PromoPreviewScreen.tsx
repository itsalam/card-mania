import { usePromoPreview } from '@/client/promos'
import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { ProductBox } from './ProductBox'

const PHASE_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  archived: 'Archived',
}

/**
 * /preview/promo/[id]?token=…: renders a promo, draft or not, with the real ProductBox for the
 * admin console's phone-frame iframe (ITS-193). The token comes from admin.issue_preview_token and
 * is the only thing that grants access: get_promo_preview returns nothing for a missing, wrong or
 * expired token, and the route id must match the token's promo. Nothing is tracked here.
 */
export function PromoPreviewScreen({ id, token }: { id: string; token: string | undefined }) {
  const { data: promo, isLoading, error } = usePromoPreview(token)
  const valid = promo && promo.id === id

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.$backgroundDefault }}
      contentContainerStyle={{
        paddingVertical: 16,
        gap: 16,
        maxWidth: 480,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={Colors.$iconNeutral} />
      ) : !valid ? (
        <Text
          style={{
            color: Colors.$textNeutral,
            textAlign: 'center',
            marginTop: 32,
            paddingHorizontal: 24,
          }}
        >
          {error
            ? "Couldn't load the preview. Try again."
            : 'This preview link is invalid or has expired. Open the preview again from the admin console.'}
        </Text>
      ) : (
        <>
          <Text variant="stats" style={{ color: Colors.$textNeutral, textAlign: 'center' }}>
            {`PREVIEW · ${PHASE_LABEL[promo.phase] ?? promo.phase}`.toUpperCase()}
          </Text>
          <ProductBox promo={promo} preview />
          <View style={{ gap: 6 }}>
            <Text variant="stats" style={{ color: Colors.$textNeutral, paddingHorizontal: 16 }}>
              {promo.placement === 'home_hero' ? 'AS A HOME RAIL BOX' : 'AS THE HOME HERO'}
            </Text>
            <ProductBox
              promo={promo}
              preview
              variant={promo.placement === 'home_hero' ? 'rail' : 'hero'}
            />
          </View>
        </>
      )}
    </ScrollView>
  )
}
