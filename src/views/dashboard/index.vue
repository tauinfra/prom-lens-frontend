<script setup lang="ts">
import { ref, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboard, getPipelinesTrend, getRecentReleases, getPipelineProjects, type DashboardCluster, type PipelinesTrendPoint, type RecentReleaseItem, type PipelineProjectItem } from '@/api/dragon'
import { message } from '@/utils/message'
import echarts from '@/plugins/echarts'
import CloudLine from '~icons/ri/cloud-line'
import ServerLine from '~icons/ri/server-line'
import StackLine from '~icons/ri/stack-line'
import Box3Line from '~icons/ri/box-3-line'
import { IconifyIconOffline } from '@/components/ReIcon'

defineOptions({ name: 'Welcome' })

const router = useRouter()

const cards = [
  { title: 'Clusters', path: '/kubernetes/clusters', icon: CloudLine, countKey: 'clusters' as const },
  { title: 'Nodes', path: '/kubernetes/nodes', icon: ServerLine, countKey: 'nodes' as const },
  { title: 'Namespaces', path: '/kubernetes/namespaces', icon: StackLine, countKey: 'namespaces' as const },
  { title: 'Pods', path: '/kubernetes/workload/pods', icon: Box3Line, countKey: 'pods' as const }
]

const clusterStats = ref<DashboardCluster>({
  clusters: 0,
  nodes: 0,
  namespaces: 0,
  pods: 0
})

const containerStats = ref({
  cpuUsage: '0%',
  memoryUsage: '0%',
  podCount: 0,
  nodeErrors: 0
})

const releaseStats = ref({
  deployToday: 0,
  success: 0,
  failed: 0,
  rollbacks: 0
})

const releaseLoading = ref(false)
const byProject = ref<PipelineProjectItem[]>([])
const projectCount = ref(0)

const recentReleases = ref<RecentReleaseItem[]>([])
const releaseChartRef = ref<HTMLDivElement | null>(null)
const releaseChartRange = ref<'today' | '7d' | '30d'>('today')
let releaseChart: ReturnType<typeof echarts.init> | null = null

interface ByHourItem {
  hour: string
  successCount: number
  failedCount: number
  rollbackCount: number
}
interface ByDayItem {
  date: string
  successCount: number
  failedCount: number
  rollbackCount: number
}
const byHour = ref<ByHourItem[]>([])
const byDay = ref<ByDayItem[]>([])

function parseListFromRes<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const d = o.data
    if (Array.isArray(d)) return d as T[]
    if (d && typeof d === 'object' && Array.isArray((d as Record<string, unknown>).data)) return (d as { data: T[] }).data
    if (Array.isArray(o.result)) return o.result as T[]
  }
  return []
}

async function fetchReleaseData() {
  releaseLoading.value = true
  try {
    const [recentRes, projectsRes] = await Promise.all([
      getRecentReleases({ env: 'prod', limit: 10 }),
      getPipelineProjects()
    ])
    recentReleases.value = parseListFromRes<RecentReleaseItem>(recentRes)
    const projectList = parseListFromRes<PipelineProjectItem>(projectsRes)
    byProject.value = projectList
    projectCount.value = projectList.length
  } catch (e) {
    message(e instanceof Error ? e.message : '获取发布记录失败', { type: 'error' })
  } finally {
    releaseLoading.value = false
    nextTick(() => renderReleaseChart())
  }
}

async function fetchDashboard() {
  try {
    const res = await getDashboard()
    const data = res?.data
    if (data?.cluster) {
      clusterStats.value = { ...data.cluster }
      containerStats.value.podCount = data.cluster.pods
    }
    if (data?.pipelines) {
      const p = data.pipelines
      releaseStats.value = {
        deployToday: p.today_total ?? 0,
        success: p.success ?? 0,
        failed: p.failed ?? 0,
        rollbacks: p.rollback ?? 0
      }
    }
  } catch (_e) {}
}

function go(path: string) {
  router.push(path)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

function formatReleaseTime(timeStr: string): string {
  if (!timeStr) return ''
  const part = timeStr.replace('T', ' ').split(' ')
  if (part.length >= 2) {
    const datePart = part[0]
    const timePart = part[1].slice(0, 5)
    const [y, mo, d] = datePart.split('-')
    return `${mo}-${d} ${timePart}`
  }
  return timeStr.slice(0, 16)
}

function releaseStatusType(status: string): 'success' | 'danger' | 'warning' {
  const s = (status || '').toLowerCase()
  if (s === 'success') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'rollback') return 'warning'
  return 'info'
}

function releaseStatusLabel(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'success') return 'Success'
  if (s === 'failed') return 'Failed'
  if (s === 'rollback') return 'Rollback'
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '-'
}

function initByHour() {
  byHour.value = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    successCount: 0,
    failedCount: 0,
    rollbackCount: 0
  }))
}

function initByDay() {
  const now = new Date()
  byDay.value = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    byDay.value.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      successCount: 0,
      failedCount: 0,
      rollbackCount: 0
    })
  }
}

function norm(p: PipelinesTrendPoint) {
  const anyP = p as Record<string, unknown>
  return {
    successCount: Number(p.success_count ?? p.success ?? anyP.successCount ?? 0) || 0,
    failedCount: Number(p.failed_count ?? p.failed ?? anyP.failedCount ?? 0) || 0,
    rollbackCount: Number(p.rollback_count ?? p.rollback ?? anyP.rollbackCount ?? 0) || 0
  }
}

function parseHour(h: string | number | undefined): number {
  if (h === undefined || h === null || h === '') return -1
  if (typeof h === 'number') return h >= 0 && h < 24 ? h : -1
  const s = String(h).trim()
  const num = parseInt(s, 10)
  if (!Number.isNaN(num) && num >= 0 && num < 24) return num
  if (s.includes(':')) return parseHour(parseInt(s.split(':')[0], 10))
  return -1
}

type TrendDataMap = { [key: string]: PipelinesTrendPoint[] }

function extractTrendList(res: unknown, range: 'today' | '7d' | '30d'): PipelinesTrendPoint[] {
  const raw = res as TrendDataMap & { data?: PipelinesTrendPoint[] | TrendDataMap; result?: PipelinesTrendPoint[]; items?: PipelinesTrendPoint[] }
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.data)) return raw.data
  if (Array.isArray((raw as { result?: PipelinesTrendPoint[] }).result)) return (raw as { result: PipelinesTrendPoint[] }).result
  if (Array.isArray((raw as { items?: PipelinesTrendPoint[] }).items)) return (raw as { items: PipelinesTrendPoint[] }).items
  if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    const dataObj = raw.data as TrendDataMap
    const byKey = dataObj[range] ?? dataObj.today ?? dataObj['7d'] ?? dataObj['30d']
    if (Array.isArray(byKey)) return byKey
    const inner = dataObj.data ?? dataObj.list ?? dataObj.points
    if (Array.isArray(inner)) return inner
  }
  return []
}

async function fetchTrendData() {
  const range = releaseChartRange.value
  try {
    const res = await getPipelinesTrend({ range })
    const list = extractTrendList(res, range)
    if (import.meta.env.DEV && list.length === 0) {
      console.warn('[Welcome] 趋势图数据为空，请检查 GET /api/v1/dashboard/pipelines/trend 响应格式。res=', res)
    }
    if (range === 'today') {
      const base = Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        successCount: 0,
        failedCount: 0,
        rollbackCount: 0
      }))
      list.forEach((p, i) => {
        let idx = parseHour(p.hour)
        if (idx < 0 && i >= 0 && i < 24) idx = i
        if (idx >= 0 && idx < 24) {
          const { successCount, failedCount, rollbackCount } = norm(p)
          base[idx] = { hour: base[idx].hour, successCount, failedCount, rollbackCount }
        }
      })
      byHour.value = base
    } else {
      const len = range === '7d' ? 7 : 30
      const now = new Date()
      const base: ByDayItem[] = []
      for (let i = len - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        base.push({
          date: `${d.getMonth() + 1}/${d.getDate()}`,
          successCount: 0,
          failedCount: 0,
          rollbackCount: 0
        })
      }
      list.forEach((p, i) => {
        if (i < base.length) {
          const { successCount, failedCount, rollbackCount } = norm(p)
          base[i] = { ...base[i], successCount, failedCount, rollbackCount }
        }
      })
      if (range === '7d') {
        byDay.value = [...byDay.value.slice(0, -7), ...base]
      } else {
        byDay.value = base
      }
    }
  } catch (_e) {}
  finally {
    nextTick(() => renderReleaseChart())
  }
}

function getChartDataByRange() {
  const range = releaseChartRange.value
  if (range === 'today') {
    const list = byHour.value
    return {
      labels: list.map((x) => x.hour),
      success: list.map((x) => x.successCount),
      failed: list.map((x) => x.failedCount),
      rollback: list.map((x) => x.rollbackCount)
    }
  }
  if (range === '7d') {
    const list = byDay.value.slice(-7)
    return {
      labels: list.map((x) => x.date),
      success: list.map((x) => x.successCount),
      failed: list.map((x) => x.failedCount),
      rollback: list.map((x) => x.rollbackCount)
    }
  }
  const list = byDay.value
  return {
    labels: list.map((x) => x.date),
    success: list.map((x) => x.successCount),
    failed: list.map((x) => x.failedCount),
    rollback: list.map((x) => x.rollbackCount)
  }
}

function renderReleaseChart() {
  if (!releaseChartRef.value) {
    if (releaseChart) {
      releaseChart.dispose()
      releaseChart = null
    }
    return
  }
  if (!releaseChart) {
    releaseChart = echarts.init(releaseChartRef.value)
    window.addEventListener('resize', handleReleaseChartResize)
  }
  const range = releaseChartRange.value
  const { labels, success, failed, rollback } = getChartDataByRange()
  if (!labels.length) {
    releaseChart.setOption({ title: { text: '暂无数据', left: 'center', top: 'middle' } })
    return
  }
  releaseChart.setOption({
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['Success', 'Failed', 'Rollback'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: 10, containLabel: true },
    xAxis: { type: 'category' as const, data: labels },
    yAxis: { type: 'value' as const },
    series: [
      { name: 'Success', type: 'line', data: success, smooth: true, itemStyle: { color: '#67c23a' } },
      { name: 'Failed', type: 'line', data: failed, smooth: true, itemStyle: { color: '#f56c6c' } },
      { name: 'Rollback', type: 'line', data: rollback, smooth: true, itemStyle: { color: '#e6a23c' } }
    ]
  })
}

function handleReleaseChartResize() {
  releaseChart?.resize()
}

watch(releaseChartRange, () => fetchTrendData())
watch([byHour, byDay], () => nextTick(() => renderReleaseChart()), { deep: true })

onMounted(() => {
  initByHour()
  initByDay()
  fetchDashboard()
  fetchReleaseData()
  fetchTrendData()
})

onBeforeUnmount(() => {
  if (releaseChart) {
    releaseChart.dispose()
    releaseChart = null
  }
  window.removeEventListener('resize', handleReleaseChartResize)
})
</script>

<template>
  <div>
    <el-row :gutter="20" class="welcome-cards">
      <el-col v-for="item in cards" :key="item.path" :xs="24" :sm="12" :md="12" :lg="6">
        <el-card class="welcome-card" shadow="hover" @click="go(item.path)">
          <div class="welcome-card-body">
            <div class="welcome-card-head">
              <div class="welcome-card-title">{{ item.title }}</div>
              <div class="welcome-card-icon">
                <IconifyIconOffline :icon="item.icon" />
              </div>
            </div>
            <div class="welcome-card-count">{{ clusterStats[item.countKey] }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="welcome-section-card" shadow="hover">
      <template #header><span>容器平台</span></template>
      <el-row :gutter="20" class="welcome-stats-row">
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">CPU Usage</div>
            <div class="welcome-stat-value">{{ containerStats.cpuUsage }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">Memory Usage</div>
            <div class="welcome-stat-value">{{ containerStats.memoryUsage }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">Pod Count</div>
            <div class="welcome-stat-value">{{ containerStats.podCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">Node Errors</div>
            <div class="welcome-stat-value">{{ containerStats.nodeErrors }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="welcome-section-card" shadow="hover">
      <template #header><span>应用发布</span></template>
      <el-row :gutter="20" class="welcome-stats-row">
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">今天发布</div>
            <div class="welcome-stat-value">{{ releaseStats.deployToday }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">成功</div>
            <div class="welcome-stat-value">{{ releaseStats.success }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">失败</div>
            <div class="welcome-stat-value">{{ releaseStats.failed }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6" :lg="6">
          <div class="welcome-stat-item">
            <div class="welcome-stat-label">回滚</div>
            <div class="welcome-stat-value">{{ releaseStats.rollbacks }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="welcome-section-card" shadow="hover" v-loading="releaseLoading">
      <template #header><span>发布记录</span></template>
      <div class="welcome-release-chart-wrap">
        <div class="welcome-release-chart-head">
          <span class="welcome-release-subtitle">趋势图（Success / Failed / Rollback）</span>
          <el-radio-group v-model="releaseChartRange" size="small" @change="renderReleaseChart">
            <el-radio-button label="today">今天</el-radio-button>
            <el-radio-button label="7d">7天</el-radio-button>
            <el-radio-button label="30d">30天</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="releaseChartRef" class="welcome-release-chart" />
      </div>
      <div class="welcome-release-tables">
        <div class="welcome-release-block welcome-release-recent">
          <div class="welcome-release-subtitle">最近发布记录</div>
          <el-table :data="recentReleases" stripe size="small" max-height="320">
            <el-table-column prop="projectName" label="项目名称"/>
            <el-table-column prop="pipeline" label="应用名称" show-overflow-tooltip/>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="releaseStatusType(row.status)" size="small">{{ releaseStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="耗时" width="85">
              <template #default="{ row }">{{ formatDuration(row.duration) }}</template>
            </el-table-column>
            <el-table-column label="时间" width="85">
              <template #default="{ row }">{{ formatReleaseTime(row.time) }}</template>
            </el-table-column>
          </el-table>
        </div>
        <div class="welcome-release-block">
          <div class="welcome-release-subtitle">按项目统计（共 {{ projectCount }} 个项目）</div>
          <el-table :data="byProject" stripe size="small" max-height="320">
            <el-table-column prop="projectName" label="项目名称" min-width="160" />
            <el-table-column prop="pipelineCount" label="应用数量" width="100" align="right" />
            <el-table-column prop="releaseCount" label="发布次数" width="100" align="right" />
            <el-table-column prop="successCount" label="成功数" width="100" align="right" />
            <el-table-column prop="failedCount" label="失败数" width="100" align="right" />
            <el-table-column prop="rollbackCount" label="回滚数" width="100" align="right" />
          </el-table>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.welcome-cards { margin-top: 20px; }
.welcome-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.2s;
  &:hover { transform: translateY(-4px); }
  :deep(.el-card__body) { padding: 28px 20px; }
}
.welcome-card-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 80px;
}
.welcome-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 16px;
}
.welcome-card-icon { font-size: 24px; color: var(--el-color-primary); line-height: 1; flex-shrink: 0; }
.welcome-card-title { font-size: 18px; color: var(--el-text-color-primary); }
.welcome-card-count { width: 100%; font-size: 30px; color: var(--el-text-color-primary); line-height: 1; text-align: center; }
.welcome-section-card { margin-top: 0; margin-bottom: 20px; }
.welcome-stats-row { min-height: 60px; }
.welcome-stat-item { text-align: center; padding: 8px 0; }
.welcome-stat-label { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.welcome-stat-value { font-size: 20px; font-weight: 600; }
.welcome-release-chart-wrap { margin-bottom: 20px; }
.welcome-release-chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.welcome-release-subtitle { font-size: 14px; color: var(--el-text-color-secondary); }
.welcome-release-chart { height: 280px; }
.welcome-release-tables { display: flex; gap: 20px; flex-wrap: wrap; }
.welcome-release-block { flex: 1; min-width: 280px; }
.welcome-release-recent .welcome-release-subtitle { margin-bottom: 8px; }
</style>
