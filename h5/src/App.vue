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

const visitorId = isAdmin ? '' : resolveVisitorId()

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

const activityNotice = computed(() => {
  if (!activity.value || result.value) return ''
  if (activity.value.status !== 'ACTIVE') return '活动暂未开放或已经结束，当前不可继续抽奖。'
  if (activity.value.remainingStock <= 0) return '本次活动奖品已全部抽完，感谢您的参与。'
  return ''
})

onMounted(async () => {
  if (isAdmin) return

  try {
    activity.value = await getActivity()
    result.value = await getMyResult(visitorId)
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
      drawPrize(visitorId),
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

function resolveVisitorId(): string {
  const key = `lucky-draw:${activitySlug}:visitor-id`

  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
  } catch {
    // Some privacy modes may deny localStorage. Fall back to an in-memory id for this page load.
  }

  const random = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const value = `visitor-${random}`

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // The draw still works for the current page even if persistence is unavailable.
  }

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

function formatResultTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
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
    <div class="ambient-cloud cloud-left" />
    <div class="ambient-cloud cloud-right" />

    <section class="brand-strip" aria-label="主办单位">
      <span>深圳市机关事务管理局</span>
      <i />
      <span>深圳交易集团有限公司</span>
    </section>

    <section class="hero">
      <p class="hero-overline">公共资源交易知识趣味问答活动</p>
      <h1>
        <span>大院小事之</span>
        <strong>深易有约</strong>
      </h1>
      <div class="hero-ribbon">扫码抽奖 · 每人仅有一次抽奖机会</div>
    </section>

    <section v-if="loading" class="panel state-panel loading-panel">
      <span class="loader" />
      <p>正在开启幸运奖池…</p>
    </section>

    <template v-else-if="activity">
      <section class="summary-row">
        <div>
          <span>剩余奖品</span>
          <strong>{{ remainingText }}</strong>
        </div>
        <div>
          <span>参与规则</span>
          <strong>每人一次</strong>
        </div>
      </section>

      <section v-if="activityNotice" class="panel state-panel activity-notice">
        <strong>{{ activityNotice }}</strong>
      </section>

      <section class="panel lottery-panel">
        <div class="panel-heading">
          <div>
            <p class="section-kicker">LUCKY DRAW</p>
            <h2>幸运抽奖</h2>
          </div>
          <button class="text-button" @click="showRules = !showRules">
            {{ showRules ? '收起规则' : '活动规则' }}
          </button>
        </div>

        <div class="lottery-stage" :class="{ spinning }">
          <div class="stage-ring ring-one" />
          <div class="stage-ring ring-two" />
          <div class="gift-box" aria-hidden="true">
            <div class="gift-bow bow-left" />
            <div class="gift-bow bow-right" />
            <div class="gift-knot" />
            <div class="gift-lid" />
            <div class="gift-body" />
            <div class="gift-ribbon" />
          </div>
          <p>{{ spinning ? '好运正在揭晓…' : result ? '中奖结果已锁定' : '点击下方按钮开启好运' }}</p>
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
            <div class="prize-copy">
              <span class="prize-level">{{ prize.level }}</span>
              <strong>{{ prize.name }}</strong>
            </div>
            <small v-if="prize.remainingStock > 0">剩余 {{ prize.remainingStock }} 份</small>
            <small v-else>已抽完</small>
          </article>
        </div>

        <div v-if="showRules" class="rules">
          <p>1. 每位参与者限参与一次，系统会记录当前浏览器设备的参与状态。</p>
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
          <span v-if="spinning">正在开奖</span>
          <span v-else-if="activity.status !== 'ACTIVE'">活动暂不可参与</span>
          <span v-else-if="activity.remainingStock <= 0">奖品已全部抽完</span>
          <span v-else>立即抽奖</span>
        </button>
      </section>

      <section v-if="result" class="result-card">
        <p class="result-label">CONGRATULATIONS</p>
        <div class="result-icon">{{ prizeEmoji(result) }}</div>
        <h2>恭喜中奖</h2>
        <p class="result-subtitle">请凭本页面前往现场兑奖处领取奖品</p>
        <div class="result-prize">
          <span>{{ result.prizeLevel }}</span>
          <strong>{{ result.prizeName }}</strong>
        </div>
        <div class="result-meta">
          <span>中奖记录 #{{ result.drawId }}</span>
          <span>{{ formatResultTime(result.drawnAt) }}</span>
        </div>
        <p v-if="result.replayed" class="replayed-tip">您已经参与过本次活动，这是您的原中奖结果。</p>
      </section>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </template>

    <section v-else class="panel state-panel error-state">
      <p>{{ errorMessage || '活动暂时无法打开' }}</p>
    </section>

    <section class="event-meta">
      <strong>深圳市民中心 B 区负一层</strong>
      <span>市民中心餐厅前展览区域</span>
      <span>2026年8月24日 11:30–13:30</span>
    </section>

    <footer>公共资源交易知识趣味问答活动</footer>
  </main>
</template>
