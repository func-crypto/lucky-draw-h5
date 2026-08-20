<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getAdminDraws, getAdminStats } from './api'
import type { AdminDrawRecord, AdminStats } from './types'

const keyStorage = 'lucky-draw:admin-key'
const adminKey = ref(window.localStorage.getItem(keyStorage) || '')
const inputKey = ref(adminKey.value)
const stats = ref<AdminStats | null>(null)
const draws = ref<AdminDrawRecord[]>([])
const loading = ref(false)
const errorMessage = ref('')

const progress = computed(() => {
  if (!stats.value || stats.value.totalStock <= 0) return 0
  return Math.round((stats.value.drawnStock / stats.value.totalStock) * 100)
})

onMounted(() => {
  if (adminKey.value) void loadDashboard()
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
        <article>
          <span>参与人数</span>
          <strong>{{ stats.participantCount }}</strong>
        </article>
        <article>
          <span>已抽出</span>
          <strong>{{ stats.drawnStock }}</strong>
        </article>
        <article>
          <span>剩余奖品</span>
          <strong>{{ stats.remainingStock }}</strong>
        </article>
        <article>
          <span>总奖品</span>
          <strong>{{ stats.totalStock }}</strong>
        </article>
      </section>

      <section class="admin-progress panel">
        <div class="admin-section-heading">
          <div>
            <span>活动进度</span>
            <strong>{{ progress }}%</strong>
          </div>
          <small>{{ stats.drawnStock }} / {{ stats.totalStock }} 份已抽出</small>
        </div>
        <div class="progress-track"><i :style="{ width: `${progress}%` }" /></div>
      </section>

      <section class="panel admin-section">
        <div class="admin-section-heading">
          <div>
            <span>PRIZE INVENTORY</span>
            <strong>奖品库存</strong>
          </div>
        </div>
        <div class="admin-prize-list">
          <article v-for="prize in stats.prizes" :key="prize.id">
            <div>
              <span>{{ prize.level }}</span>
              <strong>{{ prize.name }}</strong>
            </div>
            <div class="admin-stock-numbers">
              <b>{{ prize.remainingStock }}</b>
              <small>剩余 / {{ prize.initialStock }}</small>
            </div>
            <div class="mini-track">
              <i :style="{ width: `${prize.initialStock ? (prize.drawnStock / prize.initialStock) * 100 : 0}%` }" />
            </div>
          </article>
        </div>
      </section>

      <section class="panel admin-section">
        <div class="admin-section-heading">
          <div>
            <span>RECENT DRAWS</span>
            <strong>中奖记录</strong>
          </div>
          <small>最近 {{ draws.length }} 条</small>
        </div>

        <div v-if="draws.length" class="draw-table-wrap">
          <table class="draw-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>微信用户</th>
                <th>奖项</th>
                <th>奖品</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in draws" :key="item.drawId">
                <td>{{ formatTime(item.drawnAt) }}</td>
                <td>{{ item.openid }}</td>
                <td>{{ item.prizeLevel }}</td>
                <td>{{ item.prizeName }}</td>
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
