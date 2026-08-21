<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import QRCode from 'qrcode'
import { getAdminDraws, getAdminDrawsCsv, getAdminStats } from './api'
import type { AdminDrawRecord, AdminStats } from './types'

const keyStorage = 'lucky-draw:admin-key'
const adminKey = ref(window.localStorage.getItem(keyStorage) || '')
const inputKey = ref(adminKey.value)
const stats = ref<AdminStats | null>(null)
const draws = ref<AdminDrawRecord[]>([])
const searchText = ref('')
const loading = ref(false)
const exportLoading = ref(false)
const qrCodeDataUrl = ref('')
const linkMessage = ref('')
const errorMessage = ref('')
const previousBodyBackground = document.body.style.background
const previousBodyPadding = document.body.style.padding

const progress = computed(() => {
  if (!stats.value || stats.value.totalStock <= 0) return 0
  return Math.round((stats.value.drawnStock / stats.value.totalStock) * 100)
})

const filteredDraws = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return draws.value
  return draws.value.filter((item) =>
    [item.openid, item.prizeLevel, item.prizeName, item.drawnAt]
      .some((value) => String(value).toLowerCase().includes(keyword)),
  )
})

const activityUrl = computed(() => new URL('/', window.location.origin).toString())
const isLocalAddress = computed(() => ['localhost', '127.0.0.1'].includes(window.location.hostname))

onMounted(() => {
  document.body.style.background = '#f5eee5'
  document.body.style.padding = '0'
  void generateQrCode()
  if (adminKey.value) void loadDashboard()
})

onUnmounted(() => {
  document.body.style.background = previousBodyBackground
  document.body.style.padding = previousBodyPadding
})

async function login() {
  const next = inputKey.value.trim()
  if (!next) {
    errorMessage.value = '请输入管理员口令'
    return
  }
  adminKey.value = next
  window.localStorage.setItem(keyStorage, next)
  await loadDashboard()
}

async function loadDashboard() {
  if (!adminKey.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [nextStats, nextDraws] = await Promise.all([
      getAdminStats(adminKey.value),
      getAdminDraws(adminKey.value),
    ])
    stats.value = nextStats
    draws.value = nextDraws
  } catch (error) {
    stats.value = null
    draws.value = []
    errorMessage.value = error instanceof Error ? error.message : '后台数据加载失败'
  } finally {
    loading.value = false
  }
}

async function exportCsv() {
  if (!adminKey.value) return
  exportLoading.value = true
  errorMessage.value = ''
  try {
    const blob = await getAdminDrawsCsv(adminKey.value)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lucky-draw-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '中奖记录导出失败'
  } finally {
    exportLoading.value = false
  }
}

async function generateQrCode() {
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(activityUrl.value, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrCodeDataUrl.value = ''
  }
}

async function copyActivityUrl() {
  try {
    await navigator.clipboard.writeText(activityUrl.value)
    linkMessage.value = '活动链接已复制'
  } catch {
    linkMessage.value = '复制失败，请手动复制链接'
  }
  window.setTimeout(() => { linkMessage.value = '' }, 1800)
}

function downloadQrCode() {
  if (!qrCodeDataUrl.value) return
  const link = document.createElement('a')
  link.href = qrCodeDataUrl.value
  link.download = 'lucky-draw-activity-qr.png'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function logout() {
  window.localStorage.removeItem(keyStorage)
  adminKey.value = ''
  inputKey.value = ''
  stats.value = null
  draws.value = []
  searchText.value = ''
  errorMessage.value = ''
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value))
}
</script>

<template>
  <main class="admin-shell">
    <header class="admin-header">
      <div><p>LUCKYDRAW ADMIN</p><h1>活动数据后台</h1></div>
      <div v-if="stats" class="actions">
        <button class="primary" :disabled="loading" @click="loadDashboard">{{ loading ? '刷新中…' : '刷新' }}</button>
        <button class="primary" :disabled="exportLoading" @click="exportCsv">{{ exportLoading ? '导出中…' : '导出 CSV' }}</button>
        <button class="ghost" @click="logout">退出</button>
      </div>
    </header>

    <section v-if="!stats" class="panel login-card">
      <h2>管理员登录</h2>
      <p>输入管理员口令查看活动库存和中奖记录。</p>
      <form @submit.prevent="login">
        <input v-model="inputKey" type="password" autocomplete="current-password" placeholder="管理员口令" />
        <button class="primary" :disabled="loading" type="submit">{{ loading ? '正在进入…' : '进入后台' }}</button>
      </form>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <small>开发环境默认口令：dev-admin；正式部署请设置 ADMIN_KEY。</small>
    </section>

    <template v-else>
      <section class="titlebar"><div><span>当前活动</span><strong>{{ stats.name }}</strong></div><em>{{ stats.status === 'ACTIVE' ? '进行中' : '已结束' }}</em></section>

      <section class="panel entry-card">
        <div>
          <span class="kicker">ON-SITE ENTRY</span><h2>现场活动二维码</h2>
          <p>参与者使用微信扫一扫即可直接进入普通 H5 抽奖页面，无需公众号授权。</p>
          <div class="url-row"><code>{{ activityUrl }}</code><button class="ghost" @click="copyActivityUrl">复制链接</button></div>
          <small :class="{ warning: isLocalAddress }">{{ isLocalAddress ? '当前是本地预览地址，正式上线后再下载二维码打印。' : '当前二维码已指向正式活动入口，可直接下载打印。' }}</small>
          <b v-if="linkMessage" class="message">{{ linkMessage }}</b>
        </div>
        <div class="qr-side">
          <div class="qr-box"><img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="现场活动二维码" /><span v-else>二维码生成失败</span></div>
          <button class="primary" :disabled="!qrCodeDataUrl" @click="downloadQrCode">下载二维码 PNG</button>
        </div>
      </section>

      <section class="metrics">
        <article><span>参与人数</span><strong>{{ stats.participantCount }}</strong></article>
        <article><span>已抽出</span><strong>{{ stats.drawnStock }}</strong></article>
        <article><span>剩余奖品</span><strong>{{ stats.remainingStock }}</strong></article>
        <article><span>总奖品</span><strong>{{ stats.totalStock }}</strong></article>
      </section>

      <section class="panel"><div class="section-head"><div><span>活动进度</span><strong>{{ progress }}%</strong></div><small>{{ stats.drawnStock }} / {{ stats.totalStock }} 份已抽出</small></div><div class="track"><i :style="{ width: `${progress}%` }" /></div></section>

      <section class="panel">
        <div class="section-head"><div><span>PRIZE INVENTORY</span><strong>奖品库存</strong></div></div>
        <div class="prizes"><article v-for="prize in stats.prizes" :key="prize.id"><div><span>{{ prize.level }}</span><strong>{{ prize.name }}</strong></div><div class="stock"><b>{{ prize.remainingStock }}</b><small>剩余 / {{ prize.initialStock }}</small></div></article></div>
      </section>

      <section class="panel">
        <div class="section-head"><div><span>RECENT DRAWS</span><strong>中奖记录</strong></div><small>显示 {{ filteredDraws.length }} / {{ draws.length }} 条</small></div>
        <div class="tools"><input v-model="searchText" type="search" placeholder="搜索参与标识、奖项或奖品" /><span>页面最多展示最近 300 条，CSV 导出完整记录。</span></div>
        <div v-if="filteredDraws.length" class="table-wrap">
          <table><thead><tr><th>时间</th><th>参与标识</th><th>奖项</th><th>奖品</th></tr></thead><tbody><tr v-for="item in filteredDraws" :key="item.drawId"><td>{{ formatTime(item.drawnAt) }}</td><td>{{ item.openid }}</td><td>{{ item.prizeLevel }}</td><td>{{ item.prizeName }}</td></tr></tbody></table>
        </div>
        <p v-else class="empty">{{ draws.length ? '没有匹配的中奖记录。' : '还没有中奖记录。' }}</p>
      </section>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </template>
  </main>
</template>

<style scoped>
.admin-shell{width:min(1100px,calc(100% - 28px));margin:auto;padding:32px 0 64px;color:#2b1b18}.admin-header,.titlebar,.section-head,.url-row{display:flex;align-items:center;justify-content:space-between;gap:14px}.admin-header{margin-bottom:20px}.admin-header p,.kicker,.section-head span{margin:0;color:#a13c37;font-size:11px;font-weight:800;letter-spacing:.12em}.admin-header h1{margin:5px 0 0}.actions{display:flex;flex-wrap:wrap;gap:8px}.primary,.ghost{border:0;border-radius:11px;padding:10px 15px;font-weight:800;cursor:pointer}.primary{background:#7d1e24;color:#fff}.ghost{background:#eadfd4;color:#6d4b3d}.primary:disabled{opacity:.5}.panel{margin-top:14px;padding:20px;border:1px solid #eadbc9;border-radius:18px;background:#fffaf1}.login-card{max-width:460px;margin:70px auto 0}.login-card p{color:#816b60}.login-card form{display:grid;gap:10px;margin:18px 0}.login-card input,.tools input{min-height:44px;border:1px solid #dfd0c2;border-radius:11px;padding:0 13px;font:inherit;background:#fff}.login-card small,.section-head small,.tools span{color:#9a8174}.titlebar{padding:18px 20px;border-radius:18px;background:#701b22;color:#fff7e8}.titlebar span{display:block;font-size:11px;opacity:.7}.titlebar strong{display:block;margin-top:4px;font-size:20px}.titlebar em{font-style:normal;padding:7px 10px;border-radius:999px;background:#ffffff1f;font-size:12px}.entry-card{display:grid;grid-template-columns:1fr 210px;align-items:center;gap:24px}.entry-card h2{margin:5px 0 8px}.entry-card p{margin:0;color:#7f695f;line-height:1.7}.url-row{margin-top:14px}.url-row code{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:10px 12px;border:1px solid #e5d7ca;border-radius:10px;background:#f8efe5}.entry-card small{display:block;margin-top:8px;color:#8e766a}.entry-card small.warning{color:#a05d18}.message{display:block;margin-top:7px;color:#7d1e24;font-size:12px}.qr-side{display:grid;gap:9px}.qr-box{display:grid;place-items:center;aspect-ratio:1;border:1px solid #e4d7ca;border-radius:16px;background:#fff;overflow:hidden;color:#9a8174;font-size:12px}.qr-box img{width:100%;height:100%;object-fit:contain;padding:9px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.metrics article,.prizes article{padding:16px;border:1px solid #eadbc9;border-radius:15px;background:#fffaf1}.metrics span,.prizes span{display:block;color:#96786a;font-size:11px}.metrics strong{display:block;margin-top:5px;font-size:27px}.section-head strong{display:block;margin-top:4px;font-size:20px}.track{height:9px;margin-top:14px;border-radius:999px;background:#eadfd4;overflow:hidden}.track i{display:block;height:100%;background:linear-gradient(90deg,#a32c31,#d6a14c)}.prizes{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:15px}.prizes article{display:flex;justify-content:space-between;align-items:center}.prizes strong{display:block;margin-top:3px}.stock{text-align:right}.stock b{display:block;font-size:20px}.stock small{color:#9a8174}.tools{display:grid;grid-template-columns:minmax(220px,360px) 1fr;align-items:center;gap:12px;margin-top:14px}.table-wrap{overflow:auto;margin-top:12px;border:1px solid #eadbc9;border-radius:12px}table{width:100%;min-width:620px;border-collapse:collapse;background:#fff}th,td{padding:11px 13px;text-align:left;border-bottom:1px solid #eee2d6;font-size:12px;white-space:nowrap}th{background:#f8efe5;color:#876e61}.empty,.error{text-align:center;color:#8d252b}.empty{padding:24px;color:#9a8174}@media(max-width:720px){.admin-header{align-items:flex-start;flex-direction:column}.actions{width:100%}.actions button{flex:1}.entry-card{grid-template-columns:1fr}.qr-side{width:210px;max-width:100%;margin:auto}.metrics{grid-template-columns:repeat(2,1fr)}.prizes{grid-template-columns:1fr}.tools{grid-template-columns:1fr}.section-head{align-items:flex-start}}
</style>
