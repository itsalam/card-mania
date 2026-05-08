/**
 * Root index route.
 *
 * - Web: renders the marketing landing page
 * - Native: immediately redirects to the authenticated app shell
 */
import { Redirect } from 'expo-router'
import { Platform } from 'react-native'
import LandingPage from '@/features/web/LandingPage'

export default function IndexRoute() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/(tabs)" />
  }
  return <LandingPage />
}
