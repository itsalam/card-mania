export type OnboardingStepId =
  | 'settings-icon'
  | 'search-bar'
  | 'collection-breakdown'
  | 'tab-list'
  | 'collection-graphs'
  | 'collection-pinned-header'
  | 'collection-new-button'
  | 'collection-details-input'
  | 'collection-storefront-toggle'
  | 'collection-add-card'
  | 'add-card-number-ticker'
  | 'add-card-grade-button'

/** Identifies which step array (see steps.ts's TOURS) the onboarding store is currently
 *  running — 'main' is the app-wide first-run tour, 'collection' is the Collections-tab guide,
 *  'add-card' is the Add-to-collection search screen's guide (its own section/page count,
 *  isolated from 'collection' — see COLLECTION_TOUR_STEPS' comment in steps.ts). */
export type TourId = 'main' | 'collection' | 'add-card'

export type OnboardingStep = {
  id: OnboardingStepId
  title: string
  description: string
  panelPosition?: 'above' | 'below'
  /** Extra breathing room (px) added around this step's measured target when drawing the
   *  spotlight cutout/ring — purely a tour-overlay visual, doesn't touch the target's own
   *  layout/padding. Defaults to 0 (the existing fixed 3px ring inset still applies on top). */
  spotlightPadding?: number
  /** True when this step only advances via a real action (see advanceIfCurrentStep) rather than
   *  the panel's own Next button — typically because the next step's target lives on a screen
   *  only reached by performing that action. The panel hides Next/Done for these steps so
   *  tapping it can't skip past the real action onto a step whose target was never actually
   *  navigated to (which otherwise strands the tour on the "waiting for measurement" dim
   *  fallback). Skip (and Back, when available) still work. Note the triggering action isn't
   *  always ON the highlighted element itself (see collection-storefront-toggle, whose trigger
   *  is the unhighlighted Save button) — use actionHint to say what to actually do when it
   *  isn't just "tap the highlighted thing." */
  advanceByAction?: boolean
  /** Shown under the description when advanceByAction is true. Defaults to "Tap the highlighted
   *  button to continue" — override when the real trigger isn't the highlighted element itself. */
  actionHint?: string
  /** True when this step's target lives on a screen presented via React Navigation's
   *  `presentation: 'modal'` (e.g. add-card.tsx). Confirmed via a live device test:
   *  `measureInWindow` called on a view inside such a screen doesn't report Y relative to the
   *  same coordinate origin the app-root FullWindowOverlay/Portal (where the spotlight ring and
   *  pending-highlight ring actually render) uses — it's short by roughly the safe-area top
   *  inset, producing a ring drawn that far above the real target. OnboardingTarget adds
   *  `insets.top` back in for any step with this flag; every other (non-modal) target is
   *  unaffected. */
  modalPresentation?: boolean
}

export type TargetMeasurement = {
  x: number
  y: number
  width: number
  height: number
}
