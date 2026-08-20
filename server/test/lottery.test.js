import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../src/db.js'
import { getAdminStats, listDraws } from '../src/admin.js'
import { drawPrize, getActivity, LotteryError } from '../src/lottery.js'

test('同一用户只能消耗一次奖品', () => {
  const db = createDatabase(':memory:')
  try {
    const first = drawPrize(db, 'demo', 'user-001')
    const second = drawPrize(db, 'demo', 'user-001')
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
      drawPrize(db, 'demo', `user-${index}`)
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
      () => drawPrize(db, 'demo', 'user-261'),
      (error) => error instanceof LotteryError && error.code === 'SOLD_OUT',
    )
  } finally {
    db.close()
  }
})

test('后台统计与中奖记录保持一致并隐藏完整 openid', () => {
  const db = createDatabase(':memory:')
  try {
    drawPrize(db, 'demo', 'openid-demo-user-0001')
    drawPrize(db, 'demo', 'openid-demo-user-0002')

    const stats = getAdminStats(db, 'demo')
    const records = listDraws(db, 'demo')

    assert.equal(stats.participantCount, 2)
    assert.equal(stats.drawnStock, 2)
    assert.equal(stats.remainingStock, 258)
    assert.equal(records.length, 2)
    assert.match(records[0].openid, /^openi…000[12]$/)
    assert.equal(records.some((item) => item.openid === 'openid-demo-user-0001'), false)
  } finally {
    db.close()
  }
})
