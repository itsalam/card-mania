import { Skeleton } from 'card-mania'

export const Lines = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Skeleton style={{ width: 220, height: 16 }} />
    <Skeleton style={{ width: 180, height: 16 }} />
    <Skeleton style={{ width: 200, height: 16 }} />
  </div>
)

export const CardPlaceholder = () => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
    <Skeleton style={{ width: 60, height: 84, borderRadius: 8 }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
      <Skeleton style={{ width: 140, height: 14 }} />
      <Skeleton style={{ width: 100, height: 14 }} />
      <Skeleton style={{ width: 60, height: 20 }} />
    </div>
  </div>
)
