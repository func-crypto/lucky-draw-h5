<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AdminView from './AdminView.vue'
import { activitySlug, drawPrize, getActivity, getMyResult } from './api'
import type { ActivityView, DrawResult, PrizeView } from './types'

const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const activity = ref<ActivityView | null>(null)
const result = ref<DrawResult | null>(null)
const loading = ref(!isAdmin)
const spinning = ref(false)
const activePrizeId = ref<number | null>(null)
const errorMessage = ref('')
const showRules = ref(false)

const identityMode = import.meta.env.VITE_IDENTITY_MODE || 'dev'
const isDevIdentity = identityMode === 'dev'
const openid = isAdmin ? '' : resolveIdentity()

const canDraw = computed(() =>
  !!activity.value &&
  activity.value.status === 'ACTIVE' &&
  activity.value.remainingStock > 0 &&
  !result.value &&
  !spinning.value,
)

const remainingText = computed(() => {
  if (!activity.value) return '--'
  return `${activity.value.remainingStock} / ${activity.value.totalStock}`
})

onMounted(async () => {
  if (isAdmin) return

  try {
    activity.value = await getActivity()
    result.value = await getMyResult(openid)
    if (result.value) activePrizeId.value = result.value.prizeId
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    loading.value = false
  }
})

async function handleDraw() {
  if (!canDraw.value || !activity.value) return

  spinning.value = true
  errorMessage.value = ''
  const prizeIds = activity.value.prizes.filter((item) => item.remainingStock > 0).map((item) => item.id)
  let cursor = 0
  const timer = window.setInterval(() => {
    if (prizeIds.length === 0) return
    activePrizeId.value = prizeIds[cursor % prizeIds.length]
    cursor += 1
  }, 105)

  try {
    const [drawResult] = await Promise.all([
      drawPrize(openid),
      delay(1800),
    ])
    window.clearInterval(timer)
    activePrizeId.value = drawResult.prizeId
    result.value = drawResult
    activity.value = await getActivity()
  } catch (error) {
    window.clearInterval(timer)
    activePrizeId.value = null
    errorMessage.value = toMessage(error)
  } finally {
    spinning.value = false
  }
}

function resolveIdentity(): string {
  if (identityMode !== 'dev') {
    const injected = (window as Window & { __LUCKY_OPENID__?: string }).__LUCKY_OPENID__
    if (injected) return injected
    return 'wechat-session-required'
  }

  const key = `lucky-draw:${activitySlug}:dev-openid`
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const random = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const value = `dev-${random}`
  window.localStorage.setItem(key, value)
  return value
}

function prizeEmoji(prize: PrizeView | DrawResult): string {
  const name = 'prizeName' in prize ? prize.prizeName : prize.name
  if (name.includes('音响')) return '🔊'
  if (name.includes('咖啡')) return '☕'
  if (name.includes('手提')) return '👜'
  if (name.includes('花盆')) return '🪴'
  return '🎁'
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误'
}
</script>

<template>
  <AdminView v-if="isAdmin" />

  <main v-else class="page-shell">
    <section class="hero">
      <p class="eyebrow">LUCKY DRAW · 现场有礼</p>
      <h1>{{ activity?.name || '幸运现场抽奖' }}</h1>
      <p class="hero-copy">微信扫码 · 每人一次 · 抽奖必中奖</p>
      <div v-if="isDevIdentity" class="dev-badge">开发预览身份</div>
    </section>

    <section v-if="loading" class="panel state-panel">
      <span class="loader" />
      <p>正在打开幸运奖池…</p>
    </section>

    <template v-else-if="activity">
      <section class="summary-row">
        <div>
          <span>剩余奖品</span>
          <strong>{{ remainingText }}</strong>
        </div>
        <div>
          <span>参与规则</span>
          <strong>一人一次</strong>
        </div>
      </section>

      <section class="panel lottery-panel">
        <div class="panel-heading">
          <div>
            <p class="section-kicker">PRIZE POOL</p>
            <h2>今日奖池</h2>
          </div>
          <button class="text-button" @click="showRules = !showRules">活动规则</button>
        </div>

        <div class="prize-grid">
          <article
            v-for="prize in activity.prizes"
            :key="prize.id"
            class="prize-card"
            :class="{
              active: activePrizeId === prize.id,
              soldout: prize.remainingStock <= 0,
            }"
          >
            <div class="prize-icon">{{ prizeEmoji(prize) }}</div>
            <span class="prize-level">{{ prize.level }}</span>
            <strong>{{ prize.name }}</strong>
            <small v-if="prize.remainingStock > 0">剩余 {{ prize.remainingStock }} 份</small>
            <small v-else>已抽完</small>
          </article>
        </div>

        <div v-if="showRules" class="rules">
          <p>1. 每个微信账号在本场活动中仅可参与一次。</p>
          <p>2. 每次有效抽奖必中奖，奖品从当前剩余库存中随机产生。</p>
          <p>3. 奖品抽完后不再参与后续抽取。</p>
          <p>4. 中奖后请向现场工作人员出示中奖页面领取实物。</p>
        </div>

        <button
          v-if="!result"
          class="draw-button"
          :disabled="!canDraw"
          @click="handleDraw"
        >
          <span v-if="spinning">好运正在揭晓…</span>
          <span v-else-if="activity.remainingStock <= 0">奖品已全部抽完</span>
          <span v-else>立即抽奖</span>
        </button>
      </section>

      <section v-if="result" class="result-card">
        <p class="result-label">CONGRATULATIONS</p>
        <div class="result-icon">{{ prizeEmoji(result) }}</div>
        <h2>恭喜中奖！</h2>
        <div class="result-prize">
          <span>{{ result.prizeLevel }}</span>
          <strong>{{ result.prizeName }}</strong>
        </div>
        <p class="claim-tip">请向现场工作人员出示本页面领取奖品</p>
        <p v-if="result.replayed" class="replayed-tip">您已经参与过本次活动，这是您的原中奖结果。</p>
      </section>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </template>

    <section v-else class="panel state-panel error-state">
      <p>{{ errorMessage || '活动暂时无法打开' }}</p>
    </section>

    <footer>LuckyDraw H5 · 现场活动抽奖</footer>
  </main>
</template>
