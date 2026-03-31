import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text/base-text'
import { useDisconnectEbay, useEbayAccount } from '@/client/ebay-accounts'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { CheckCircle, Link, Link2Off } from 'lucide-react-native'
import React from 'react'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { AccessoryProps } from './types'

const EBAY_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize'
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const CALLBACK_DEEP_LINK = 'cardmania://auth/ebay'

function buildEbayAuthUrl(accessToken: string): string {
  const redirectUri = `${SUPABASE_URL}/functions/v1/ebay-oauth-callback`
  const params = new URLSearchParams({
    client_id: process.env.EXPO_PUBLIC_EBAY_APP_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    state: accessToken,
  })
  return `${EBAY_AUTH_URL}?${params.toString()}`
}

export function EbayConnect({ children }: AccessoryProps) {
  const { session } = useUserStore()
  const { data: account, isLoading } = useEbayAccount()
  const disconnect = useDisconnectEbay()
  const toast = useToast()
  const qc = useQueryClient()

  const handleConnect = async () => {
    const accessToken = session?.access_token
    if (!accessToken) {
      toast.showToast({
        title: 'Sign in required',
        message: 'You must be signed in to connect eBay.',
      })
      return
    }

    const authUrl = buildEbayAuthUrl(accessToken)
    const result = await WebBrowser.openAuthSessionAsync(authUrl, CALLBACK_DEEP_LINK)

    if (result.type === 'success') {
      const resultUrl = new URL(result.url)
      const status = resultUrl.searchParams.get('status')
      const username = resultUrl.searchParams.get('username')

      if (status === 'success' && username) {
        await qc.invalidateQueries({ queryKey: ['ebay-account'] })
        toast.showToast({ title: 'eBay connected', message: `Connected as @${username}` })
      } else {
        const reason = resultUrl.searchParams.get('reason') ?? 'unknown'
        toast.showToast({ title: 'Connection failed', message: reason })
      }
    }
  }

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.showToast({ title: 'eBay disconnected' }),
      onError: (e) => toast.showToast({ title: 'Error', message: (e as Error).message }),
    })
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 12,
      }}
    >
      {children}

      {isLoading ? (
        <ActivityIndicator color={Colors.$iconDefault} />
      ) : account ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} color={Colors.$iconSuccess} />
          <Text variant={'default'} style={{ color: Colors.$textDefault }}>
            @{account.ebay_username}
          </Text>
          <TouchableOpacity
            onPress={handleDisconnect}
            disabled={disconnect.isPending}
            style={{
              marginLeft: 4,
              padding: 6,
              borderRadius: BorderRadiuses.br20,
              borderWidth: 1,
              borderColor: Colors.$outlineNeutral,
            }}
          >
            {disconnect.isPending ? (
              <Spinner />
            ) : (
              <Link2Off size={16} color={Colors.$iconNeutral} />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleConnect}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: BorderRadiuses.br50,
            backgroundColor: Colors.$backgroundPrimaryMedium,
          }}
        >
          <Link size={14} color={Colors.$textPrimary} />
          <Text variant={'default'} style={{ color: Colors.$textPrimary, fontWeight: '600' }}>
            Connect
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default EbayConnect
