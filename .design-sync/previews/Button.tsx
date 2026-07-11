import { Button } from 'card-mania'

export const Default = () => <Button>Buy Now</Button>

export const Variants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
    <Button variant="primary">Primary</Button>
    <Button variant="destructive">Destructive</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
  </div>
)

export const Sizes = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
    <Button size="lg">Large</Button>
    <Button size="default">Default</Button>
    <Button size="sm">Small</Button>
  </div>
)
