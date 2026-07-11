import { SkeletonText } from 'card-mania'

export const CardDetailRows = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <SkeletonText variant="h1" loading>
      Card Name
    </SkeletonText>
    <SkeletonText variant="muted" loading>
      Set Name
    </SkeletonText>
    <SkeletonText loading>$485.00</SkeletonText>
  </div>
)

export const Loaded = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <SkeletonText variant="h1" loading={false}>
      Charizard
    </SkeletonText>
    <SkeletonText variant="muted" loading={false}>
      Base Set
    </SkeletonText>
    <SkeletonText loading={false}>$485.00</SkeletonText>
  </div>
)
