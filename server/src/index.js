import { createDatabase } from './db.js'
import { createApp } from './app.js'

const db = createDatabase()
const app = createApp({ db })
const port = Number(process.env.PORT || 3000)

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`LuckyDraw server: http://localhost:${port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
