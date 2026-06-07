/**
 * Root index route.
 *
 * - Web: renders the marketing landing page
 * - Native: immediately redirects to the authenticated app shell
 */
import LandingPage from '@/features/web/LandingPage'
import { Redirect } from 'expo-router'
import { Platform } from 'react-native'

export default function IndexRoute() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/(tabs)" />
  }
  return <LandingPage />
}
