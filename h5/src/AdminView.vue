<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getAdminDraws, getAdminStats } from './api'
import type { AdminDrawRecord, AdminStats } from './types'

const keyStorage = 'lucky-draw:admin-key'
const adminKey = ref(window.localStorage.getItem(keyStorage) || '')
const inputKey = ref(adminKey.value)
const stats = ref<AdminStats | null>(null)
const draws = ref<AdminDrawRecord[]>([])
const loading = ref(false)
const errorMessage = ref('')
const previousBodyBackground = document.body.style.background
const previousBodyPadding = document.body.style.padding

const progress = computed(() => {
  if (!stats.value || stats.value.totalStock <= 0) return 0
  return Math.round((stats.value.drawnStock / stats.value.totalStock) * 100)
})

onMounted(() => {
  document.body.style.background = '#f5eee5'
  document.body.style.padding = '0'
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

function logout() {
  window.localStorage.removeItem(keyStorage)
  adminKey.value = ''
  inputKey.value = ''
  stats.value = null
  draws.value = []
  errorMessage.value = ''
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
</script>

<template>
  <main class="admin-shell">
    <header class="admin-header">
      <div>
        <p class="section-kicker">LUCKYDRAW ADMIN</p>
        <h1>活动数据后台</h1>
      </div>
      <div v-if="stats" class="admin-actions">
        <button class="admin-secondary" :disabled="loading" @click="loadDashboard">刷新</button>
        <button class="admin-ghost" @click="logout">退出</button>
      </div>
    </header>

    <section v-if="!stats" class="admin-login panel">
      <h2>管理员登录</h2>
      <p>输入活动管理员口令即可查看库存和中奖记录。</p>
      <form @submit.prevent="login">
        <input v-model="inputKey" type="password" autocomplete="current-password" placeholder="管理员口令" />
        <button class="admin-primary" :disabled="loading" type="submit">
          {{ loading ? '正在进入…' : '进入后台' }}
        </button>
      </form>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <small class="admin-dev-tip">开发环境默认口令：dev-admin；正式部署请设置 ADMIN_KEY。</small>
    </section>

    <template v-else>
      <section class="admin-titlebar">
        <div>
          <span>当前活动</span>
          <strong>{{ stats.name }}</strong>
        </div>
        <em>{{ stats.status === 'ACTIVE' ? '进行中' : '已结束' }}</em>
      </section>

      <section class="admin-metrics">
        <article><span>参与人数</span><strong>{{ stats.participantCount }}</strong></article>
        <article><span>已抽出</span><strong>{{ stats.drawnStock }}</strong></article>
        <article><span>剩余奖品</span><strong>{{ stats.remainingStock }}</strong></article>
        <article><span>总奖品</span><strong>{{ stats.totalStock }}</strong></article>
      </section>

      <section class="admin-progress panel">
        <div class="admin-section-heading">
          <div><span>活动进度</span><strong>{{ progress }}%</strong></div>
          <small>{{ stats.drawnStock }} / {{ stats.totalStock }} 份已抽出</small>
        </div>
        <div class="progress-track"><i :style="{ width: `${progress}%` }" /></div>
      </section>

      <section class="panel admin-section">
        <div class="admin-section-heading">
          <div><span>PRIZE INVENTORY</span><strong>奖品库存</strong></div>
        </div>
        <div class="admin-prize-list">
          <article v-for="prize in stats.prizes" :key="prize.id">
            <div><span>{{ prize.level }}</span><strong>{{ prize.name }}</strong></div>
            <div class="admin-stock-numbers"><b>{{ prize.remainingStock }}</b><small>剩余 / {{ prize.initialStock }}</small></div>
            <div class="mini-track"><i :style="{ width: `${prize.initialStock ? (prize.drawnStock / prize.initialStock) * 100 : 0}%` }" /></div>
          </article>
        </div>
      </section>

      <section class="panel admin-section">
        <div class="admin-section-heading">
          <div><span>RECENT DRAWS</span><strong>中奖记录</strong></div>
          <small>最近 {{ draws.length }} 条</small>
        </div>
        <div v-if="draws.length" class="draw-table-wrap">
          <table class="draw-table">
            <thead><tr><th>时间</th><th>微信用户</th><th>奖项</th><th>奖品</th></tr></thead>
            <tbody>
              <tr v-for="item in draws" :key="item.drawId">
                <td>{{ formatTime(item.drawnAt) }}</td><td>{{ item.openid }}</td><td>{{ item.prizeLevel }}</td><td>{{ item.prizeName }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="admin-empty">还没有中奖记录。</p>
      </section>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </template>
  </main>
</template>

<style scoped>
.admin-shell{width:min(1100px,calc(100% - 32px));margin:0 auto;padding:36px 0 70px;color:#2b1b18}.admin-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}.admin-header h1{margin:6px 0 0;font-size:30px}.admin-actions{display:flex;gap:8px}.admin-secondary,.admin-ghost,.admin-primary{border:0;border-radius:12px;padding:11px 16px;font-weight:800;cursor:pointer}.admin-secondary,.admin-primary{background:#7d1e24;color:#fff}.admin-ghost{background:#eadfd4;color:#6d4b3d}.admin-login{max-width:460px;margin:80px auto 0}.admin-login h2{margin:0 0 8px}.admin-login>p{color:#816b60}.admin-login form{display:grid;gap:10px;margin-top:22px}.admin-login input{min-height:48px;border:1px solid #dfd0c2;border-radius:12px;padding:0 14px;font:inherit;background:#fff}.admin-dev-tip{display:block;margin-top:16px;color:#a58c7d;line-height:1.6}.admin-titlebar{display:flex;justify-content:space-between;align-items:center;padding:20px 22px;border-radius:20px;background:#701b22;color:#fff7e8;margin-bottom:14px}.admin-titlebar span{display:block;font-size:11px;opacity:.7}.admin-titlebar strong{display:block;margin-top:4px;font-size:20px}.admin-titlebar em{font-style:normal;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.12);font-size:12px}.admin-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.admin-metrics article{padding:18px;border-radius:18px;background:#fffaf1;border:1px solid rgba(100,57,31,.09)}.admin-metrics span{display:block;color:#96786a;font-size:12px}.admin-metrics strong{display:block;margin-top:6px;font-size:28px}.admin-section,.admin-progress{margin-top:14px}.admin-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}.admin-section-heading span{display:block;color:#a13c37;font-size:11px;font-weight:800;letter-spacing:.12em}.admin-section-heading strong{display:block;margin-top:4px;font-size:20px}.admin-section-heading small{color:#9a8174}.progress-track,.mini-track{overflow:hidden;border-radius:999px;background:#eadfd4}.progress-track{height:10px;margin-top:16px}.progress-track i,.mini-track i{display:block;height:100%;background:linear-gradient(90deg,#a32c31,#d6a14c);transition:width .25s ease}.admin-prize-list{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:18px}.admin-prize-list article{position:relative;padding:16px;border-radius:16px;background:#fbf4ea;border:1px solid #eadbc9}.admin-prize-list span{display:block;color:#a13c37;font-size:11px}.admin-prize-list strong{display:block;margin-top:3px}.admin-stock-numbers{position:absolute;right:16px;top:14px;text-align:right}.admin-stock-numbers b{display:block;font-size:20px}.admin-stock-numbers small{color:#9a8174}.mini-track{height:6px;margin-top:14px}.draw-table-wrap{overflow:auto;margin-top:16px;border:1px solid #eadbc9;border-radius:14px}.draw-table{width:100%;border-collapse:collapse;min-width:620px;background:#fffdf9}.draw-table th,.draw-table td{padding:12px 14px;text-align:left;border-bottom:1px solid #eee2d6;font-size:12px;white-space:nowrap}.draw-table th{color:#876e61;background:#f8efe5}.draw-table tr:last-child td{border-bottom:0}.admin-empty{padding:28px 0 10px;text-align:center;color:#9a8174}@media(max-width:700px){.admin-shell{width:min(100% - 24px,1100px);padding-top:24px}.admin-header{align-items:flex-start}.admin-header h1{font-size:24px}.admin-metrics{grid-template-columns:repeat(2,1fr)}.admin-prize-list{grid-template-columns:1fr}.admin-login{margin-top:40px}}
</style>
