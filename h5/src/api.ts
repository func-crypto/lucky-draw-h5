import type { ActivityView, DrawResult } from './types'

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
export const activitySlug = import.meta.env.VITE_ACTIVITY_SLUG || 'demo'

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`, init)
  if (response.status === 204) return null

  if (!response.ok) {
    let message = `请求失败 (${response.status})`
    try {
      const payload = await response.json()
      message = payload.message || payload.detail || message
    } catch {
      // Keep fallback message when the response is not JSON.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export async function getActivity(): Promise<ActivityView> {
  const data = await request<ActivityView>(`/api/v1/activities/${activitySlug}`)
  if (!data) throw new Error('活动数据为空')
  return data
}

export async function getMyResult(openid: string): Promise<DrawResult | null> {
  return request<DrawResult>(`/api/v1/activities/${activitySlug}/me`, {
    headers: { 'X-User-OpenId': openid },
  })
}

export async function drawPrize(openid: string): Promise<DrawResult> {
  const data = await request<DrawResult>(`/api/v1/activities/${activitySlug}/draw`, {
    method: 'POST',
    headers: { 'X-User-OpenId': openid },
  })
  if (!data) throw new Error('抽奖结果为空')
  return data
}
