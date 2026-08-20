import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWechatAuthorizeUrl,
  createOAuthState,
  createUserSession,
  exchangeWechatCode,
  readUserSession,
  sanitizeReturnTo,
  verifyOAuthState,
} from '../src/wechat-auth.js'

const secret = 'test-session-secret-that-is-long-enough'
const now = 1_800_000_000_000

test('OAuth state 保留安全的站内返回地址并拒绝篡改', () => {
  const token = createOAuthState('/?from=qr', secret, now)
  assert.deepEqual(verifyOAuthState(token, secret, now + 1000), { returnTo: '/?from=qr' })

  const tampered = `${token.slice(0, -1)}x`
  assert.equal(verifyOAuthState(tampered, secret, now + 1000), null)
  assert.equal(sanitizeReturnTo('https://evil.example/'), '/')
  assert.equal(sanitizeReturnTo('//evil.example/'), '/')
})

test('签名用户会话只能从有效 HttpOnly Cookie 值恢复 OpenID', () => {
  const token = createUserSession('openid-user-001', secret, now)
  const cookie = `other=1; lucky_session=${encodeURIComponent(token)}; theme=light`

  assert.deepEqual(readUserSession(cookie, secret, now + 1000), { openid: 'openid-user-001' })
  assert.equal(readUserSession(cookie, 'wrong-secret', now + 1000), null)
  assert.equal(readUserSession(cookie, secret, now + 8 * 24 * 60 * 60 * 1000), null)
})

test('微信授权 URL 使用静默 snsapi_base 并携带回调与 state', () => {
  const url = buildWechatAuthorizeUrl({
    appId: 'wx-app-id',
    redirectUri: 'https://lottery.example.com/auth/wechat/callback',
    state: 'signed-state',
  })

  assert.match(url, /^https:\/\/open\.weixin\.qq\.com\/connect\/oauth2\/authorize\?/)
  assert.match(url, /appid=wx-app-id/)
  assert.match(url, /scope=snsapi_base/)
  assert.match(url, /state=signed-state/)
  assert.match(url, /#wechat_redirect$/)
})

test('微信 code 换取 OpenID 的网络调用可独立测试且不依赖真实微信', async () => {
  let requestedUrl = ''
  const openid = await exchangeWechatCode({
    appId: 'wx-app-id',
    appSecret: 'wx-secret',
    code: 'oauth-code',
    fetchImpl: async (url) => {
      requestedUrl = String(url)
      return {
        ok: true,
        json: async () => ({ openid: 'openid-from-wechat' }),
      }
    },
  })

  assert.equal(openid, 'openid-from-wechat')
  assert.match(requestedUrl, /appid=wx-app-id/)
  assert.match(requestedUrl, /code=oauth-code/)
  assert.match(requestedUrl, /grant_type=authorization_code/)
})
