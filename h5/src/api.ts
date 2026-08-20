import type { ActivityView, AdminDrawRecord, AdminStats, DrawResult } from './types'

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
export const activitySlug = import.meta.env.VITE_ACTIVITY_SLUG || 'demo'
export const identityMode = import.meta.env.VITE_IDENTITY_MODE || 'dev'

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    ...init,
  })
  if (response.status === 204) return null

  if (!response.ok) {
    throw await responseError(response)
  }

  return response.json() as Promise<T>
}

async function responseError(response: Response): Promise<ApiError> {
  let message = `请求失败 (${response.status})`
  let code = 'REQUEST_FAILED'
  try {
    const payload = await response.json()
    message = payload.message || payload.detail || message
    code = payload.code || code
  } catch {
    // Keep fallback values when the response is not JSON.
  }
  return new ApiError(response.status, code, message)
}

function userHeaders(openid: string): HeadersInit | undefined {
  if (identityMode !== 'dev') return undefined
  return { 'X-User-OpenId': openid }
}

export async function getActivity(): Promise<ActivityView> {
  const data = await request<ActivityView>(`/api/v1/activities/${activitySlug}`)
  if (!data) throw new Error('活动数据为空')
  return data
}

export async function getMyResult(openid: string): Promise<DrawResult | null> {
  return request<DrawResult>(`/api/v1/activities/${activitySlug}/me`, {
    headers: userHeaders(openid),
  })
}

export async function drawPrize(openid: string): Promise<DrawResult> {
  const data = await request<DrawResult>(`/api/v1/activities/${activitySlug}/draw`, {
    method: 'POST',
    headers: userHeaders(openid),
  })
  if (!data) throw new Error('抽奖结果为空')
  return data
}

export async function getAdminStats(adminKey: string): Promise<AdminStats> {
  const data = await request<AdminStats>(`/api/admin/${activitySlug}/stats`, {
    headers: { 'X-Admin-Key': adminKey },
  })
  if (!data) throw new Error('后台数据为空')
  return data
}

export async function getAdminDraws(adminKey: string): Promise<AdminDrawRecord[]> {
  const data = await request<{ items: AdminDrawRecord[] }>(`/api/admin/${activitySlug}/draws?limit=300`, {
    headers: { 'X-Admin-Key': adminKey },
  })
  return data?.items || []
}

export async function getAdminDrawsCsv(adminKey: string): Promise<Blob> {
  const response = await fetch(`${apiBase}/api/admin/${activitySlug}/draws.csv`, {
    credentials: 'include',
    headers: { 'X-Admin-Key': adminKey },
  })
  if (!response.ok) {
    throw await responseError(response)
  }
  return response.blob()
}
