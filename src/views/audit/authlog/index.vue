<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAuthLogs } from '@/api/audit'
import { message } from "@/utils/message"
import { Refresh } from "@element-plus/icons-vue"
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({ name: "AuditAuthLog" })

// -------------------------------
// 类型定义
// -------------------------------
interface AuthLog {
  id: number
  username: string
  ipAddress: string
  system: string
  agent: string
  statusCode: number
  success?: boolean
  createdAt: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination?: Pagination
  code: number
  msg?: string
  success: boolean
}

// -------------------------------
// 分页和搜索
// -------------------------------
const { pagination, refresh } = usePaginatedSearch(fetchAuthLogs, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'created_at',
  initialSortOrder: 'desc'
})

// 表格数据
const data = ref<AuthLog[]>([])

// -------------------------------
// API 调用
// -------------------------------
async function fetchAuthLogs(p: Pagination) {
  try {
    const response = await getAuthLogs({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<AuthLog[]>
    if (!response.success) {
      message(response.msg)
      return
    }
    data.value = response.data ?? []
    pagination.value.total = response.pagination?.total ?? 0
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

// -------------------------------
// 生命周期
// -------------------------------
onMounted(() => {
  refresh()
})
const refreshClick = () => refresh()
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="username" label="用户名"></el-table-column>
      <el-table-column prop="ipAddress" label="IP 地址"></el-table-column>
      <el-table-column prop="system" label="系统版本"></el-table-column>
      <el-table-column prop="agent" label="客户端"></el-table-column>
      <el-table-column prop="success" label="登录状态">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'">
            {{ row.success ? '登录成功' : '登录失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="登录时间" width="170">
        <template #default="scope">
          {{ formatDate(scope.row.createdAt) }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 表单分页 -->
    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right;"
    />
  </div>
</template>

<style scoped lang="scss">
</style>
