import { Badge } from 'card-mania'

export const Grades = () => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
    {['PSA 10', 'PSA 9', 'BGS 9.5', 'CGC 8', 'Raw'].map((grade) => (
      <Badge key={grade} label={grade} variant="default" />
    ))}
  </div>
)

export const Statuses = () => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
    {['Pending', 'Accepted', 'Declined', 'Completed'].map((status) => (
      <Badge key={status} label={status} variant="square" />
    ))}
  </div>
)
