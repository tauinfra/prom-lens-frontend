<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAuditLogs } from '@/api/audit'
import { message } from "@/utils/message"
import { Refresh } from "@element-plus/icons-vue"
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({ name: "AuditLog" })

// -------------------------------
// 类型定义
// -------------------------------
interface AuditLog {
  id: number
  username: string
  urlPath: string
  method: string
  ipAddress: string
  agent: string
  statusCode: number
  params: unknown
  response: unknown
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
const { pagination, refresh } = usePaginatedSearch(fetchAuditLogs, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'created_at',
  initialSortOrder: 'desc'
})

// 表格数据
const data = ref<AuditLog[]>([])

// -------------------------------
// API 调用
// -------------------------------
async function fetchAuditLogs(p: Pagination) {
  try {
    const response = await getAuditLogs({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<AuditLog[]>
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

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const formatJsonPretty = (value: unknown) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
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
      <el-button type="info" plain @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="username" label="用户名" min-width="140"></el-table-column>
      <el-table-column prop="ipAddress" label="IP 地址" min-width="140"></el-table-column>
      <el-table-column prop="urlPath" label="请求路径" show-overflow-tooltip min-width="260"></el-table-column>
      <el-table-column prop="method" label="请求方法" width="90"></el-table-column>
      <el-table-column prop="agent" label="客户端" min-width="220"></el-table-column>
      <el-table-column prop="statusCode" label="状态码" width="100"></el-table-column>
      <el-table-column prop="params" label="参数" min-width="220">
        <template #default="scope">
          <el-tooltip effect="dark" placement="top" :show-after="300">
            <template #content>
              <pre class="tooltip-pre">{{ formatJsonPretty(scope.row.params) }}</pre>
            </template>
            <span class="cell-ellipsis">{{ formatJson(scope.row.params) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="response" label="响应" min-width="220">
        <template #default="scope">
          <el-tooltip effect="dark" placement="top" :show-after="300">
            <template #content>
              <pre class="tooltip-pre">{{ formatJsonPretty(scope.row.response) }}</pre>
            </template>
            <span class="cell-ellipsis">{{ formatJson(scope.row.response) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="操作时间" width="180">
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
.cell-ellipsis {
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.tooltip-pre {
  margin: 0;
  max-width: 480px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
