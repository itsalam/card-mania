import { Card, } from '../ui/card'

export function BaseCard({ children, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card size="md" {...props}>
      {children}
    </Card>
  )
}
