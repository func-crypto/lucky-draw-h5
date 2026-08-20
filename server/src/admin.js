export function getAdminStats(db, slug) {
  const activity = db.prepare(`
    SELECT id, slug, name, status
    FROM activities
    WHERE slug = ?
  `).get(slug)

  if (!activity) return null

  const prizes = db.prepare(`
    SELECT id, level, name, initial_stock, remaining_stock
    FROM prizes
    WHERE activity_id = ?
    ORDER BY sort_order, id
  `).all(activity.id)

  const drawCount = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM draws
    WHERE activity_id = ?
  `).get(activity.id).count)

  const totalStock = prizes.reduce((sum, prize) => sum + prize.initial_stock, 0)
  const remainingStock = prizes.reduce((sum, prize) => sum + prize.remaining_stock, 0)

  return {
    id: activity.id,
    slug: activity.slug,
    name: activity.name,
    status: activity.status,
    participantCount: drawCount,
    totalStock,
    drawnStock: totalStock - remainingStock,
    remainingStock,
    prizes: prizes.map((prize) => ({
      id: prize.id,
      level: prize.level,
      name: prize.name,
      initialStock: prize.initial_stock,
      drawnStock: prize.initial_stock - prize.remaining_stock,
      remainingStock: prize.remaining_stock,
    })),
  }
}

export function listDraws(db, slug, limit = 200) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500))

  return db.prepare(`
    SELECT
      d.id AS draw_id,
      d.openid,
      d.drawn_at,
      p.level AS prize_level,
      p.name AS prize_name
    FROM draws d
    JOIN activities a ON a.id = d.activity_id
    JOIN prizes p ON p.id = d.prize_id
    WHERE a.slug = ?
    ORDER BY d.id DESC
    LIMIT ?
  `).all(slug, safeLimit).map((row) => ({
    drawId: row.draw_id,
    openid: maskOpenId(row.openid),
    prizeLevel: row.prize_level,
    prizeName: row.prize_name,
    drawnAt: row.drawn_at,
  }))
}

function maskOpenId(openid) {
  if (!openid) return ''
  if (openid.length <= 10) return openid
  return `${openid.slice(0, 5)}…${openid.slice(-4)}`
}
