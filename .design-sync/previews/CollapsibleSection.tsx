import { CollapsibleSection } from 'card-mania'

const Row = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: '8px 16px',
    }}
  >
    <span style={{ color: '#a1a1aa' }}>{label}</span>
    <span style={{ color: '#fafafa', fontWeight: 500 }}>{value}</span>
  </div>
)

export const Default = () => (
  <CollapsibleSection title="Card Details">
    <Row label="Set" value="Base Set" />
    <Row label="Number" value="4/102" />
    <Row label="Rarity" value="Holo Rare" />
    <Row label="Edition" value="1st Edition" />
  </CollapsibleSection>
)

export const WithRightElement = () => (
  <CollapsibleSection title="Active Listings">
    <Row label="PSA 10" value="$52,000" />
    <Row label="PSA 9" value="$18,000" />
    <Row label="Ungraded" value="$9,500" />
  </CollapsibleSection>
)
