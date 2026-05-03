export type OnboardingStepId =
  | 'settings-icon'
  | 'search-bar'
  | 'collection-breakdown'
  | 'tab-list'
  | 'collection-graphs'

export type OnboardingStep = {
  id: OnboardingStepId
  title: string
  description: string
  panelPosition?: 'above' | 'below'
}

export type TargetMeasurement = {
  x: number
  y: number
  width: number
  height: number
}
