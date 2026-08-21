import type { ActivityView, AdminDrawRecord, AdminStats, DrawResult } from './types'

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
export const activitySlug = import.meta.env.VITE_ACTIVITY_SLUG || 'demo'

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`, init)
  if (response.status === 204) return null

  if (!response.ok) {
    throw new Error(await responseMessage(response))
  }

  return response.json() as Promise<T>
}

async function responseMessage(response: Response): Promise<string> {
  let message = `请求失败 (${response.status})`
  try {
    const payload = await response.json()
    message = payload.message || payload.detail || message
  } catch {
    // Keep fallback message when the response is not JSON.
  }
  return message
}

function visitorHeaders(visitorId: string): HeadersInit {
  return { 'X-Visitor-Id': visitorId }
}

export async function getActivity(): Promise<ActivityView> {
  const data = await request<ActivityView>(`/api/v1/activities/${activitySlug}`)
  if (!data) throw new Error('活动数据为空')
  return data
}

export async function getMyResult(visitorId: string): Promise<DrawResult | null> {
  return request<DrawResult>(`/api/v1/activities/${activitySlug}/me`, {
    headers: visitorHeaders(visitorId),
  })
}

export async function drawPrize(visitorId: string): Promise<DrawResult> {
  const data = await request<DrawResult>(`/api/v1/activities/${activitySlug}/draw`, {
    method: 'POST',
    headers: visitorHeaders(visitorId),
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
    headers: { 'X-Admin-Key': adminKey },
  })
  if (!response.ok) {
    throw new Error(await responseMessage(response))
  }
  return response.blob()
}
