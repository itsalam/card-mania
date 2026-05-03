import { OnboardingStep } from './types'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'settings-icon',
    title: 'Your Profile',
    description: 'Access your settings, preferences, and account details here.',
    panelPosition: 'below',
  },
  {
    id: 'search-bar',
    title: 'Search Everything',
    description: 'Find any card by name, set, or price. Tap here to start searching.',
    panelPosition: 'below',
  },
  {
    id: 'collection-breakdown',
    title: 'Collection at a Glance',
    description: 'See your wishlist, selling pile, and vault value — all in one place.',
    panelPosition: 'below',
  },
  {
    id: 'tab-list',
    title: 'Explore Your Feed',
    description: 'Switch between Feed, Explore, and Price Sheets to browse the market.',
    panelPosition: 'above',
  },
  {
    id: 'collection-graphs',
    title: 'Track your items',
    description: "View your collections prices overtime and see how it's value progresses.",
    panelPosition: 'below',
  },
]
