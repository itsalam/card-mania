import { Card, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'

/** Landing page for a role with no pages (shouldn't happen for owner/editor/ops). */
export default function ComingSoon() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        <CardTitle>Nothing here for your role yet</CardTitle>
        <CardDescription>
          You're signed in, but no pages are available for your role. Ask an owner if that's unexpected.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
