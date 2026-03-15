<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getReportSummary } from '@/api/dragon'
import { message } from '@/utils/message'
import { Refresh } from '@element-plus/icons-vue'

defineOptions({ name: 'DragonReport' })

interface Summary {
  totalReleases: number
  successCount: number
  failedCount: number
  failureRate: number
  rollbackCount: number
  rollbackRate: number
}

interface ByMonthItem {
  month: string
  total: number
  successCount: number
  failedCount: number
  rollbackCount: number
}

interface ByProjectItem {
  projectID: number
  projectName: string
  releaseCount: number
  successCount: number
  failedCount: number
  rollbackCount: number
}

interface ReportData {
  summary: Summary
  byMonth: ByMonthItem[]
  byProject: ByProjectItem[]
  projectCount: number
}

interface ApiResponse<T = unknown> {
  data?: T
  success: boolean
  msg?: string
}

const loading = ref(false)
const summary = ref<Summary | null>(null)
const byMonth = ref<ByMonthItem[]>([])
const byProject = ref<ByProjectItem[]>([])
const projectCount = ref(0)

function formatPercent(value: number) {
  return `${typeof value === 'number' ? value.toFixed(1) : value}%`
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getReportSummary() as ApiResponse<ReportData>
    if (!res.success || !res.data) {
      message(res.msg || '获取数据失败', { type: 'error' })
      return
    }
    summary.value = res.data.summary ?? null
    byMonth.value = res.data.byMonth ?? []
    byProject.value = res.data.byProject ?? []
    projectCount.value = res.data.projectCount ?? 0
  } catch (e) {
    message(e instanceof Error ? e.message : '获取数据失败', { type: 'error' })
  } finally {
    loading.value = false
  }
}

function refreshClick() {
  fetchData()
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <el-button type="primary" plain @click="refreshClick" :loading="loading">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <!-- 汇总卡片 -->
    <el-row :gutter="16" class="summary-row" v-loading="loading">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">总发布数</div>
          <div class="stat-value">{{ summary?.totalReleases ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card shadow="hover" class="stat-card stat-success">
          <div class="stat-label">成功数</div>
          <div class="stat-value">{{ summary?.successCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card shadow="hover" class="stat-card stat-danger">
          <div class="stat-label">失败数</div>
          <div class="stat-value">{{ summary?.failedCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">失败率</div>
          <div class="stat-value">{{ summary != null ? formatPercent(summary.failureRate) : '-' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card shadow="hover" class="stat-card stat-warning">
          <div class="stat-label">回滚数</div>
          <div class="stat-value">{{ summary?.rollbackCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">回滚率</div>
          <div class="stat-value">{{ summary != null ? formatPercent(summary.rollbackRate) : '-' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 按月份统计 -->
    <el-card class="section-card" shadow="hover">
      <template #header>
        <span>按月份统计</span>
      </template>
      <el-table :data="byMonth" stripe>
        <el-table-column prop="month" label="月份" width="120" />
        <el-table-column prop="total" label="发布总数" width="100" align="right" />
        <el-table-column prop="successCount" label="成功数" width="100" align="right" />
        <el-table-column prop="failedCount" label="失败数" width="100" align="right" />
        <el-table-column prop="rollbackCount" label="回滚数" width="100" align="right" />
      </el-table>
    </el-card>

    <!-- 按项目统计 -->
    <el-card class="section-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>按项目统计</span>
          <span class="header-extra">共 {{ projectCount }} 个项目</span>
        </div>
      </template>
      <el-table :data="byProject" stripe>
        <el-table-column prop="projectName" label="项目名称" min-width="160" />
        <el-table-column prop="releaseCount" label="发布次数" width="100" align="right" />
        <el-table-column prop="successCount" label="成功数" width="100" align="right" />
        <el-table-column prop="failedCount" label="失败数" width="100" align="right" />
        <el-table-column prop="rollbackCount" label="回滚数" width="100" align="right" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.summary-row {
  margin-bottom: 20px;
}

.stat-card {
  margin-bottom: 16px;

  .stat-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 600;
  }

  &.stat-success .stat-value {
    color: var(--el-color-success);
  }

  &.stat-danger .stat-value {
    color: var(--el-color-danger);
  }

  &.stat-warning .stat-value {
    color: var(--el-color-warning);
  }
}

.section-card {
  margin-bottom: 20px;

  .card-header {
    display: flex;
    align-items: center;
  }

  .header-extra {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-left: 12px;
  }
}
</style>
