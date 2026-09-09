import { OnboardingStep, TourId } from './types'

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

/**
 * Collections-tab guided flow (ITS-104) — walks a not-yet-activated user through creating a
 * storefront collection and adding their first card. Unlike ONBOARDING_STEPS' targets (all on
 * one screen), these five span three screens reached by real navigation: the Collections list,
 * the new-collection screen (details-input + storefront-toggle both live here), and a created
 * collection's detail screen. The "new-button" and "storefront-toggle" steps are marked
 * advanceByAction: true and don't advance via the panel's own Next button — they advance when
 * the corresponding real action fires (see advanceIfCurrentStep calls at the "+" button in
 * TabList.tsx and the save button in modify-collection/components.tsx), since the panel has no
 * way to wait for a screen that isn't mounted yet; showing a working-looking Next there would
 * let the user skip past the real action onto a step whose target was never navigated to.
 * "details-input" doesn't need this — its next step (storefront-toggle) is already on the same
 * screen, so the panel's own Next works fine there.
 *
 * storefront-toggle's real trigger is the Save button below it, not the toggle itself — flipping
 * it or tapping elsewhere does nothing, and shouldn't, since nothing has actually happened yet
 * (the collection isn't created, so there's no next-step target to advance to). Its actionHint
 * says so explicitly rather than reusing the generic "tap the highlighted button" text, since
 * the highlighted element here isn't the one that advances the tour.
 */
export const COLLECTION_TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'collection-pinned-header',
    title: 'Pinned Collections',
    description:
      'Vault, Wishlist, and Selling are pinned here by default — pin any collection for quick access.',
    panelPosition: 'below',
    // The measured target hugs its content tightly (mx-3/mr-5 margins, no internal padding) —
    // extra room here makes the highlight read as "this whole section" rather than a tight
    // outline around just the tab pills.
    spotlightPadding: 10,
  },
  {
    id: 'collection-new-button',
    title: 'Start a Collection',
    description: 'Create your first collection here.',
    panelPosition: 'below',
    advanceByAction: true,
  },
  {
    id: 'collection-details-input',
    title: 'Name Your Collection',
    description: 'Give it a name and description so you can find it later.',
    panelPosition: 'below',
  },
  {
    id: 'collection-storefront-toggle',
    title: 'Set Up Your Storefront',
    description: 'Turn this on to make the collection publicly searchable for sale.',
    panelPosition: 'above',
    // Not advanceByAction, unlike collection-new-button — the collection isn't created yet at
    // this point in the flow, so there's no reachable "save succeeded" action to gate on (the
    // overlay sits in front of the Save button). Toggling the switch (see StorefrontOptions'
    // onCheckedChange in modify-collection/components.tsx) still advances immediately as a real
    // action, but the panel's own Next is also shown so a user who doesn't want a storefront
    // isn't stuck here.
    spotlightPadding: 10,
  },
  {
    id: 'collection-add-card',
    title: 'Add Your First Card',
    description: 'Tap Add to bring in your first card.',
    panelPosition: 'above',
  },
]

/**
 * Add-to-collection search screen's guided flow — its own tour/section (own page-number count,
 * own onboarding_state flag), deliberately isolated from COLLECTION_TOUR_STEPS rather than
 * appended to it, so a user who's already finished the Collections tour (or skipped it) still
 * gets this guide the first time they reach this screen, and vice versa. Neither step is
 * advanceByAction — both show the panel's own Next/Done so a user isn't forced to actually
 * change the quantity or tap Grade to move on, matching "not forced to fully follow." Toggling
 * the ticker or tapping the Grade button still auto-advances immediately as a bonus real-action
 * path (see the advanceIfCurrentStep calls in editable-entry-item.tsx and
 * add-to-collections/components.tsx), same "either dismissing or the real action" pattern used
 * for collection-storefront-toggle.
 *
 * Both targets only exist on the first search result row once results actually appear (this
 * screen has no default listing — see useCardSearch's `enabled` gate) — the trigger itself
 * (useAddCardTourTrigger in OnboardingProvider.tsx) is fired from that first row's own mount, so
 * the tour never starts before there's an actual target to show it against.
 */
export const ADD_CARD_TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'add-card-number-ticker',
    title: 'Set Your Quantity',
    description: 'Tap + or − to set how many of this card you own.',
    panelPosition: 'below',
    spotlightPadding: 6,
    // add-card.tsx is presented via presentation: 'modal' — see modalPresentation's own comment
    // in types.ts for why this step's spotlight needs the safe-area correction.
    modalPresentation: true,
  },
  {
    id: 'add-card-grade-button',
    title: 'Add a Grade',
    description: 'Tag a graded copy with its grading company and condition.',
    panelPosition: 'above',
    modalPresentation: true,
  },
]

/**
 * "Send your first offer" guided flow (ITS-105) — its own tour/section, isolated from the others
 * for the same reason as ADD_CARD_TOUR_STEPS. A single step, deliberately not triggered by a
 * card's detail view being shown (too early — the user hasn't committed to anything yet, and
 * "Add to Deal" is self-explanatory) but by the cart itself expanding (useOffersTourTrigger is
 * called from CartSheetInner in features/cart/ui.tsx), spotlighting the one real decision left:
 * "Send Offer". Not advanceByAction — it's both the first and last step, so Next/Done stays
 * visible (no strand risk), while also advancing immediately on a successful submit as a bonus
 * real-action path — same "either dismissing or the real action" pattern as
 * collection-storefront-toggle / add-card-*.
 *
 * The target lives on the cart's `presentation: 'transparentModal'` screen (see app/_layout.tsx)
 * — the same class of screen that needed modalPresentation's safe-area correction for
 * add-card.tsx (a `presentation: 'modal'` screen) — flagged here too pending live verification,
 * since it's the same underlying window/coordinate-space mismatch mechanism.
 */
export const OFFERS_TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'offers-send-offer',
    title: 'Send Your Offer',
    description: 'Review the total, then tap Send Offer to submit it to the seller.',
    panelPosition: 'above',
    modalPresentation: true,
  },
]

export const TOURS: Record<TourId, OnboardingStep[]> = {
  main: ONBOARDING_STEPS,
  collection: COLLECTION_TOUR_STEPS,
  'add-card': ADD_CARD_TOUR_STEPS,
  offers: OFFERS_TOUR_STEPS,
}
