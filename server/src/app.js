import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getActivity, getMyResult, drawPrize, LotteryError } from './lottery.js'
import { exportDrawsCsv, getAdminStats, listDraws } from './admin.js'

const defaultH5Dist = fileURLToPath(new URL('../../h5/dist', import.meta.url))

export function createApp({ db, h5Dist = process.env.H5_DIST || defaultH5Dist }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, identityMode: 'visitor' })
  })

  app.get('/api/v1/activities/:slug', (req, res) => {
    res.set('Cache-Control', 'no-store')
    const activity = getActivity(db, req.params.slug)
    if (!activity) {
      return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' })
    }
    return res.json(activity)
  })

  app.get('/api/v1/activities/:slug/me', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const visitorId = requireVisitorId(req)
      const result = getMyResult(db, req.params.slug, visitorId)
      if (!result) return res.status(204).end()
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/v1/activities/:slug/draw', (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const visitorId = requireVisitorId(req)
      return res.json(drawPrize(db, req.params.slug, visitorId))
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

function requireVisitorId(req) {
  const visitorId = req.get('X-Visitor-Id')?.trim()
  if (!visitorId || visitorId.length < 8 || visitorId.length > 160) {
    throw new LotteryError('IDENTITY_REQUIRED', '参与标识失效，请刷新页面后重试', 401)
  }
  return visitorId
}

function requireAdmin(req) {
  const configuredKey = process.env.ADMIN_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-admin')
  const providedKey = req.get('X-Admin-Key')?.trim()

  if (!configuredKey || !providedKey || providedKey !== configuredKey) {
    throw new LotteryError('ADMIN_UNAUTHORIZED', '管理员口令不正确', 401)
  }
}
