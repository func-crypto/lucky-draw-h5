import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getActivity, getMyResult, drawPrize, LotteryError } from './lottery.js'
import { getAdminStats, listDraws } from './admin.js'

const defaultH5Dist = fileURLToPath(new URL('../../h5/dist', import.meta.url))

export function createApp({ db, h5Dist = process.env.H5_DIST || defaultH5Dist }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
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
      const openid = requireIdentity(req)
      return res.json(drawPrize(db, req.params.slug, openid))
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/admin/:slug/stats', (req, res, next) => {
    try {
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
      requireAdmin(req)
      return res.json({ items: listDraws(db, req.params.slug, req.query.limit) })
    } catch (error) {
      return next(error)
    }
  })

  if (existsSync(h5Dist)) {
    app.use(express.static(h5Dist))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
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
  // 开发阶段使用请求头模拟 OpenID；正式微信 OAuth 接入时只替换这里的身份来源。
  const openid = req.get('X-User-OpenId')?.trim()
  if (!openid) {
    throw new LotteryError('IDENTITY_REQUIRED', '请先完成微信身份授权', 401)
  }
  return openid
}

function requireAdmin(req) {
  const configuredKey = process.env.ADMIN_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-admin')
  const providedKey = req.get('X-Admin-Key')?.trim()

  if (!configuredKey || !providedKey || providedKey !== configuredKey) {
    throw new LotteryError('ADMIN_UNAUTHORIZED', '管理员口令不正确', 401)
  }
}
