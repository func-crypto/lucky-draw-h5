import { randomInt } from 'node:crypto'

export class LotteryError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'LotteryError'
    this.code = code
    this.status = status
  }
}

export function getActivity(db, slug) {
  const activity = db.prepare(`
    SELECT id, slug, name, status
    FROM activities
    WHERE slug = ?
  `).get(slug)

  if (!activity) return null

  const prizes = db.prepare(`
    SELECT id, level, name, image_url, initial_stock, remaining_stock
    FROM prizes
    WHERE activity_id = ?
    ORDER BY sort_order, id
  `).all(activity.id)

  const totalStock = prizes.reduce((sum, prize) => sum + prize.initial_stock, 0)
  const remainingStock = prizes.reduce((sum, prize) => sum + prize.remaining_stock, 0)

  return {
    id: activity.id,
    slug: activity.slug,
    name: activity.name,
    status: activity.status,
    totalStock,
    remainingStock,
    prizes: prizes.map(toPrizeView),
  }
}

export function getMyResult(db, slug, openid) {
  const row = db.prepare(`
    SELECT
      d.id AS draw_id,
      d.drawn_at,
      p.id AS prize_id,
      p.level AS prize_level,
      p.name AS prize_name,
      p.image_url AS prize_image_url
    FROM draws d
    JOIN activities a ON a.id = d.activity_id
    JOIN prizes p ON p.id = d.prize_id
    WHERE a.slug = ? AND d.openid = ?
  `).get(slug, openid)

  return row ? toDrawResult(row, true) : null
}

export function drawPrize(db, slug, openid) {
  const cleanOpenId = String(openid || '').trim()
  if (!cleanOpenId) {
    throw new LotteryError('IDENTITY_REQUIRED', '请先完成微信身份授权', 401)
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    const activity = db.prepare(`
      SELECT id, status
      FROM activities
      WHERE slug = ?
    `).get(slug)

    if (!activity) {
      throw new LotteryError('ACTIVITY_NOT_FOUND', '活动不存在', 404)
    }

    const existing = getDrawByActivityAndOpenId(db, activity.id, cleanOpenId)
    if (existing) {
      db.exec('COMMIT')
      return toDrawResult(existing, true)
    }

    if (activity.status !== 'ACTIVE') {
      throw new LotteryError('ACTIVITY_CLOSED', '活动当前不可参与', 409)
    }

    const prizes = db.prepare(`
      SELECT id, level, name, image_url, remaining_stock
      FROM prizes
      WHERE activity_id = ? AND remaining_stock > 0
      ORDER BY sort_order, id
    `).all(activity.id)

    const totalRemaining = prizes.reduce((sum, prize) => sum + prize.remaining_stock, 0)
    if (totalRemaining <= 0) {
      throw new LotteryError('SOLD_OUT', '本次活动奖品已全部抽完', 409)
    }

    let ticket = randomInt(totalRemaining)
    let selected = prizes[prizes.length - 1]

    for (const prize of prizes) {
      if (ticket < prize.remaining_stock) {
        selected = prize
        break
      }
      ticket -= prize.remaining_stock
    }

    const updated = db.prepare(`
      UPDATE prizes
      SET remaining_stock = remaining_stock - 1
      WHERE id = ? AND remaining_stock > 0
    `).run(selected.id)

    if (updated.changes !== 1) {
      throw new LotteryError('DRAW_CONFLICT', '抽奖人数较多，请再试一次', 409)
    }

    const drawnAt = new Date().toISOString()
    const inserted = db.prepare(`
      INSERT INTO draws (activity_id, openid, prize_id, drawn_at)
      VALUES (?, ?, ?, ?)
    `).run(activity.id, cleanOpenId, selected.id, drawnAt)

    db.exec('COMMIT')
    return {
      drawId: Number(inserted.lastInsertRowid),
      prizeId: selected.id,
      prizeLevel: selected.level,
      prizeName: selected.name,
      prizeImageUrl: selected.image_url,
      drawnAt,
      replayed: false,
    }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function getDrawByActivityAndOpenId(db, activityId, openid) {
  return db.prepare(`
    SELECT
      d.id AS draw_id,
      d.drawn_at,
      p.id AS prize_id,
      p.level AS prize_level,
      p.name AS prize_name,
      p.image_url AS prize_image_url
    FROM draws d
    JOIN prizes p ON p.id = d.prize_id
    WHERE d.activity_id = ? AND d.openid = ?
  `).get(activityId, openid)
}

function toPrizeView(row) {
  return {
    id: row.id,
    level: row.level,
    name: row.name,
    imageUrl: row.image_url,
    initialStock: row.initial_stock,
    remainingStock: row.remaining_stock,
  }
}

function toDrawResult(row, replayed) {
  return {
    drawId: row.draw_id,
    prizeId: row.prize_id,
    prizeLevel: row.prize_level,
    prizeName: row.prize_name,
    prizeImageUrl: row.prize_image_url,
    drawnAt: row.drawn_at,
    replayed,
  }
}
