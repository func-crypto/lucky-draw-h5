import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getActivity, getMyResult, drawPrize, LotteryError } from './lottery.js'
import { exportDrawsCsv, getAdminStats, listDraws } from './admin.js'
import {
  buildWechatAuthorizeUrl,
  createOAuthState,
  createUserSession,
  exchangeWechatCode,
  getIdentityMode,
  getWechatConfig,
  readUserSession,
  sanitizeReturnTo,
  setUserSessionCookie,
  validateWechatConfig,
  verifyOAuthState,
} from './wechat-auth.js'

const defaultH5Dist = fileURLToPath(new URL('../../h5/dist', import.meta.url))

export function createApp({ db, h5Dist = process.env.H5_DIST || defaultH5Dist }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, identityMode: getIdentityMode() })
  })

  app.get('/auth/wechat', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const config = requireWechatConfig()
      const returnTo = sanitizeReturnTo(req.query.returnTo)
      const redirectUri = new URL('/auth/wechat/callback', config.publicBaseUrl).toString()
      const state = createOAuthState(returnTo, config.sessionSecret)
      return res.redirect(buildWechatAuthorizeUrl({ appId: config.appId, redirectUri, state }))
    } catch (error) {
      return next(error)
    }
  })

  app.get('/auth/wechat/callback', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const config = requireWechatConfig()
      const code = String(req.query.code || '').trim()
      const state = verifyOAuthState(String(req.query.state || ''), config.sessionSecret)

      if (!code || !state) {
        throw new LotteryError('WECHAT_AUTH_INVALID', '微信授权已失效，请重新进入活动', 400)
      }

      let openid
      try {
        openid = await exchangeWechatCode({
          appId: config.appId,
          appSecret: config.appSecret,
          code,
        })
      } catch (error) {
        console.error('WeChat OAuth exchange failed:', error)
        throw new LotteryError('WECHAT_AUTH_FAILED', '微信授权失败，请重新进入活动', 502)
      }

      const token = createUserSession(openid, config.sessionSecret)
      const secure = new URL(config.publicBaseUrl).protocol === 'https:'
      setUserSessionCookie(res, token, secure)
      return res.redirect(state.returnTo)
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/v1/activities/:slug', (req, res) => {
    const activity = getActivity(db, req.params.slug)
    if (!activity) {
      return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' })
    }
    return res.json(activity)
  })

  app.get('/api/v1/activities/:slug/me', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const openid = requireIdentity(req)
      const result = getMyResult(db, req.params.slug, openid)
      if (!result) return res.status(204).end()
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/v1/activities/:slug/draw', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const openid = requireIdentity(req)
      return res.json(drawPrize(db, req.params.slug, openid))
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/admin/:slug/stats', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      requireAdmin(req)
      const stats = getAdminStats(db, req.params.slug)
      if (!stats) {
        return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' })
      }
      return res.json(stats)
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/admin/:slug/draws', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      requireAdmin(req)
      return res.json({ items: listDraws(db, req.params.slug, req.query.limit) })
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/admin/:slug/draws.csv', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      requireAdmin(req)
      const stats = getAdminStats(db, req.params.slug)
      if (!stats) {
        return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' })
      }

      res.type('text/csv; charset=utf-8')
      res.set('Content-Disposition', `attachment; filename="${req.params.slug}-draws.csv"`)
      return res.send(exportDrawsCsv(db, req.params.slug))
    } catch (error) {
      return next(error)
    }
  })

  if (existsSync(h5Dist)) {
    app.use(express.static(h5Dist))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next()
      return res.sendFile(`${h5Dist}/index.html`)
    })
  }

  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在' })
  })

  app.use((error, _req, res, _next) => {
    if (error instanceof LotteryError) {
      return res.status(error.status).json({ code: error.code, message: error.message })
    }

    console.error(error)
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务暂时不可用' })
  })

  return app
}

function requireIdentity(req) {
  const mode = getIdentityMode()

  if (mode === 'dev') {
    const openid = req.get('X-User-OpenId')?.trim()
    if (!openid) {
      throw new LotteryError('IDENTITY_REQUIRED', '请先完成微信身份授权', 401)
    }
    return openid
  }

  if (mode === 'wechat') {
    const config = requireWechatConfig()
    const session = readUserSession(req.get('cookie'), config.sessionSecret)
    if (!session?.openid) {
      throw new LotteryError('IDENTITY_REQUIRED', '请先完成微信身份授权', 401)
    }
    return session.openid
  }

  throw new LotteryError('IDENTITY_MODE_INVALID', '身份模式配置错误', 500)
}

function requireWechatConfig() {
  const config = getWechatConfig()
  const missing = validateWechatConfig(config)
  if (missing.length) {
    throw new LotteryError('WECHAT_NOT_CONFIGURED', `微信授权尚未配置：${missing.join(', ')}`, 503)
  }

  try {
    new URL(config.publicBaseUrl)
  } catch {
    throw new LotteryError('WECHAT_NOT_CONFIGURED', 'PUBLIC_BASE_URL 配置无效', 503)
  }

  return config
}

function requireAdmin(req) {
  const configuredKey = process.env.ADMIN_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-admin')
  const providedKey = req.get('X-Admin-Key')?.trim()

  if (!configuredKey || !providedKey || providedKey !== configuredKey) {
    throw new LotteryError('ADMIN_UNAUTHORIZED', '管理员口令不正确', 401)
  }
}
