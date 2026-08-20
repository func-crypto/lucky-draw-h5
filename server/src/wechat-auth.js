import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_COOKIE = 'lucky_session'
const STATE_MAX_AGE_MS = 10 * 60 * 1000
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function getIdentityMode() {
  return process.env.IDENTITY_MODE || 'dev'
}

export function getWechatConfig() {
  return {
    appId: process.env.WECHAT_APP_ID?.trim() || '',
    appSecret: process.env.WECHAT_APP_SECRET?.trim() || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || '',
    sessionSecret: process.env.SESSION_SECRET?.trim() || '',
  }
}

export function validateWechatConfig(config = getWechatConfig()) {
  const missing = []
  if (!config.appId) missing.push('WECHAT_APP_ID')
  if (!config.appSecret) missing.push('WECHAT_APP_SECRET')
  if (!config.publicBaseUrl) missing.push('PUBLIC_BASE_URL')
  if (!config.sessionSecret) missing.push('SESSION_SECRET')
  return missing
}

export function buildWechatAuthorizeUrl({ appId, redirectUri, state }) {
  const query = new URLSearchParams({
    appid: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'snsapi_base',
    state,
  })
  return `https://open.weixin.qq.com/connect/oauth2/authorize?${query.toString()}#wechat_redirect`
}

export async function exchangeWechatCode({ appId, appSecret, code, fetchImpl = fetch }) {
  const query = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code,
    grant_type: 'authorization_code',
  })

  const response = await fetchImpl(`https://api.weixin.qq.com/sns/oauth2/access_token?${query.toString()}`)
  if (!response.ok) {
    throw new Error(`微信授权接口请求失败 (${response.status})`)
  }

  const payload = await response.json()
  if (payload.errcode || !payload.openid) {
    throw new Error(payload.errmsg || '微信授权未返回 OpenID')
  }

  return String(payload.openid)
}

export function createOAuthState(returnTo, secret, now = Date.now()) {
  return signPayload({
    returnTo: sanitizeReturnTo(returnTo),
    nonce: randomBytes(12).toString('hex'),
    exp: now + STATE_MAX_AGE_MS,
  }, secret)
}

export function verifyOAuthState(token, secret, now = Date.now()) {
  const payload = verifySignedPayload(token, secret)
  if (!payload || typeof payload.exp !== 'number' || payload.exp < now) return null
  return {
    returnTo: sanitizeReturnTo(payload.returnTo),
  }
}

export function createUserSession(openid, secret, now = Date.now()) {
  return signPayload({
    openid: String(openid),
    exp: now + SESSION_MAX_AGE_MS,
  }, secret)
}

export function readUserSession(cookieHeader, secret, now = Date.now()) {
  const token = parseCookie(cookieHeader, SESSION_COOKIE)
  if (!token) return null
  const payload = verifySignedPayload(token, secret)
  if (!payload || typeof payload.exp !== 'number' || payload.exp < now || !payload.openid) return null
  return { openid: String(payload.openid) }
}

export function setUserSessionCookie(res, token, secure = true) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  })
}

export function sanitizeReturnTo(value) {
  const text = String(value || '/').trim()
  if (!text.startsWith('/') || text.startsWith('//')) return '/'
  return text
}

function signPayload(payload, secret) {
  if (!secret) throw new Error('SESSION_SECRET 未配置')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verifySignedPayload(token, secret) {
  if (!token || !secret) return null
  const [body, signature, extra] = String(token).split('.')
  if (!body || !signature || extra) return null

  const expected = createHmac('sha256', secret).update(body).digest()
  let actual
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function parseCookie(header, name) {
  if (!header) return ''
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    if (key !== name) continue
    return decodeURIComponent(part.slice(index + 1).trim())
  }
  return ''
}
