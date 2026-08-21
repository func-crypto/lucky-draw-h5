import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../src/db.js'
import { exportDrawsCsv, getAdminStats, listDraws } from '../src/admin.js'
import { drawPrize, getActivity, LotteryError } from '../src/lottery.js'

test('同一 visitorId 只能消耗一次奖品', () => {
  const db = createDatabase(':memory:')
  try {
    const first = drawPrize(db, 'demo', 'visitor-001')
    const second = drawPrize(db, 'demo', 'visitor-001')
    const activity = getActivity(db, 'demo')

    assert.equal(second.drawId, first.drawId)
    assert.equal(second.prizeId, first.prizeId)
    assert.equal(second.replayed, true)
    assert.equal(activity.remainingStock, 259)
  } finally {
    db.close()
  }
})

test('260 份固定奖池精确耗尽且不会超发', () => {
  const db = createDatabase(':memory:')
  try {
    for (let index = 0; index < 260; index += 1) {
      drawPrize(db, 'demo', `visitor-${index}`)
    }

    const activity = getActivity(db, 'demo')
    assert.equal(activity.totalStock, 260)
    assert.equal(activity.remainingStock, 0)
    assert.deepEqual(
      activity.prizes.map((prize) => [prize.name, prize.remainingStock]),
      [
        ['音响', 0],
        ['咖啡杯', 0],
        ['黄麻手提袋', 0],
        ['小花盆', 0],
      ],
    )

    assert.throws(
      () => drawPrize(db, 'demo', 'visitor-261'),
      (error) => error instanceof LotteryError && error.code === 'SOLD_OUT',
    )
  } finally {
    db.close()
  }
})

test('后台统计与中奖记录保持一致并隐藏完整参与标识', () => {
  const db = createDatabase(':memory:')
  try {
    drawPrize(db, 'demo', 'visitor-demo-user-0001')
    drawPrize(db, 'demo', 'visitor-demo-user-0002')

    const stats = getAdminStats(db, 'demo')
    const records = listDraws(db, 'demo')

    assert.equal(stats.participantCount, 2)
    assert.equal(stats.drawnStock, 2)
    assert.equal(stats.remainingStock, 258)
    assert.equal(records.length, 2)
    assert.match(records[0].openid, /^visit…000[12]$/)
    assert.equal(records.some((item) => item.openid === 'visitor-demo-user-0001'), false)
  } finally {
    db.close()
  }
})

test('CSV 导出包含参与标识表头并保持标识脱敏', () => {
  const db = createDatabase(':memory:')
  try {
    drawPrize(db, 'demo', 'visitor-export-user-0001')
    const csv = exportDrawsCsv(db, 'demo')

    assert.equal(csv.startsWith('\uFEFF记录ID,中奖时间,参与标识,奖项,奖品'), true)
    assert.match(csv, /visit…0001/)
    assert.equal(csv.includes('visitor-export-user-0001'), false)
    assert.equal(csv.split('\r\n').length, 2)
  } finally {
    db.close()
  }
})
