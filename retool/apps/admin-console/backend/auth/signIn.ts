type Params = {
  email: string
  password: string
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  msg?: string
  message?: string
  error_description?: string
  error_code?: string
  user?: { email?: string }
}

export default async function (req: { params: Params }) {
  const { email, password } = req.params
  if (!email || !password) {
    return { ok: false as const, message: 'Email and password are required.' }
  }
  try {
    const res = await cardManiaStaging.rawRequest<TokenResponse>({
      path: '/auth/v1/token',
      method: 'POST',
      queryParams: { grant_type: 'password' },
      bodyType: 'json',
      body: { email, password },
    })
    const data = res.data
    if (!data || !data.access_token) {
      return {
        ok: false as const,
        message: data?.msg || data?.message || data?.error_description || 'Sign-in failed.',
      }
    }
    return {
      ok: true as const,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? '',
        expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
        email: data.user?.email ?? email,
      },
    }
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
  }
}
