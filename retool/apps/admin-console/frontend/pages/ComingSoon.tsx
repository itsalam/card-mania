import { Card, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'

/** Landing page for roles with no pages yet (editor, until the content tools ship in ITS-193/110). */
export default function ComingSoon() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        <CardTitle>Content tools are coming soon</CardTitle>
        <CardDescription>
          Promo boxes and home feed sections will appear here. You're signed in and your role is set.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
