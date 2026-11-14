import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { useAuth } from '../context/AuthContext'
import { ShieldX } from 'lucide-react'

export default function NotAuthorized() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <ShieldX className="mx-auto w-10 h-10 text-destructive" />
          <CardTitle>Not authorized</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
