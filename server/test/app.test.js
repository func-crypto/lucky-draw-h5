import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createDatabase } from '../src/db.js'
import { createApp } from '../src/app.js'

test('API 使用 X-Visitor-Id 控制参与身份并拒绝旧微信身份头', async () => {
  const db = createDatabase(':memory:')
  const app = createApp({ db, h5Dist: '/tmp/lucky-draw-missing-dist' })
  const server = app.listen(0, '127.0.0.1')

  try {
    await once(server, 'listening')
    const address = server.address()
    assert.equal(typeof address, 'object')
    const baseUrl = `http://127.0.0.1:${address.port}`

    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json())
    assert.deepEqual(health, { ok: true, identityMode: 'visitor' })

    const missingIdentity = await fetch(`${baseUrl}/api/v1/activities/demo/draw`, { method: 'POST' })
    assert.equal(missingIdentity.status, 401)

    const oldWechatHeader = await fetch(`${baseUrl}/api/v1/activities/demo/draw`, {
      method: 'POST',
      headers: { 'X-User-OpenId': 'openid-old-mode' },
    })
    assert.equal(oldWechatHeader.status, 401)

    const headers = { 'X-Visitor-Id': 'visitor-api-test-0001' }
    const first = await fetch(`${baseUrl}/api/v1/activities/demo/draw`, { method: 'POST', headers }).then((response) => response.json())
    const second = await fetch(`${baseUrl}/api/v1/activities/demo/draw`, { method: 'POST', headers }).then((response) => response.json())

    assert.equal(second.drawId, first.drawId)
    assert.equal(second.prizeId, first.prizeId)
    assert.equal(second.replayed, true)
  } finally {
    server.close()
    await once(server, 'close')
    db.close()
  }
})
