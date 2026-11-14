type Params = {
  refreshToken: string
}

type RefreshResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  msg?: string
  message?: string
  error_description?: string
  error_code?: string
}

export default async function (req: { params: Params }) {
  const { refreshToken } = req.params
  if (!refreshToken) {
    return { ok: false as const, message: 'Missing refresh token.' }
  }
  try {
    const res = await cardManiaStaging.rawRequest<RefreshResponse>({
      path: '/auth/v1/token',
      method: 'POST',
      queryParams: { grant_type: 'refresh_token' },
      bodyType: 'json',
      body: { refresh_token: refreshToken },
    })
    const data = res.data
    if (!data || !data.access_token) {
      return {
        ok: false as const,
        message: data?.msg || data?.message || data?.error_description || 'Token refresh failed.',
      }
    }
    return {
      ok: true as const,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
      },
    }
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
  }
}
