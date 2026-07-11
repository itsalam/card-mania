import { Text } from 'card-mania'

export const Variants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Text variant="h1">Heading 1</Text>
    <Text variant="h2">Heading 2</Text>
    <Text variant="h3">Heading 3</Text>
    <Text variant="large">Large — card name</Text>
    <Text variant="default">Default — body copy</Text>
    <Text variant="muted">Muted — secondary info</Text>
    <Text variant="small">Small — caption</Text>
    <Text variant="info">INFO — metadata label</Text>
    <Text variant="stats">STATS — $485.00</Text>
  </div>
)

export const CardDetail = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <Text variant="info">Pokémon • Base Set</Text>
    <Text variant="h3">Charizard Holo Rare 1st Edition</Text>
    <Text variant="muted">Shadowless • 4/102</Text>
    <Text variant="h2">$48,500</Text>
    <Text variant="small">Last sale: 3 days ago</Text>
  </div>
)
