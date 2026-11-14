import { useRef, useState } from 'react'
import { useUploadPromoImage } from '../../hooks/backend/storage'
import { useAuth } from '../../context/AuthContext'
import type { FnResult } from '../../context/AuthContext'
import { Button } from '../../lib/shadcn/button'
import { Alert, AlertDescription } from '../../lib/shadcn/alert'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { promoAssetUrl } from '../../utils/promo'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

type Props = {
  promoId: string | undefined
  path: string | null
  onChange: (path: string | null) => void
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

/** Hero art: uploads to the promo-assets bucket and stores the object path on the promo. */
export function HeroUpload({ promoId, path, onChange }: Props) {
  const { callAdmin } = useAuth()
  const { trigger } = useUploadPromoImage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!TYPES.includes(file.type)) {
      setError('Use a PNG, JPEG or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Images must be 5 MB or smaller.')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await readAsDataUrl(file)
      const res = (await callAdmin((token) =>
        trigger({ accessToken: token, promoId: promoId ?? null, contentType: file.type, dataBase64: dataUrl }),
      )) as FnResult | undefined
      if (!res?.ok) {
        setError(res?.message ?? 'Upload failed.')
        return
      }
      onChange((res.data as { path: string }).path)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const url = promoAssetUrl(path)

  return (
    <div className="space-y-2">
      {url ? (
        <div className="overflow-hidden rounded-md border border-border">
          <img src={url} alt="Hero art" className="aspect-[16/9] w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
          No image. The app uses the accent colour instead.
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={TYPES.join(',')}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {path ? 'Replace image' : 'Upload image'}
        </Button>
        {path ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 5 MB. Wide (16:9) works best.</span>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
