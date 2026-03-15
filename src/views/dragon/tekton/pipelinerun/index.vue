<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  getTektonPipelineRuns,
  deleteTektonPipelineRun,
  deleteTektonPipelineRuns
} from '@/api/dragon'
import { message } from "@/utils/message"
import { Minus, Refresh } from "@element-plus/icons-vue"
import { ElMessageBox } from 'element-plus'

defineOptions({ name: "DRGTektonPipelineRun" })

interface TektonPipelineRun {
  name: string
  namespace?: string
  createdAt?: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination?: {
    page: number
    size: number
    total: number
  }
  code: number
  msg?: string
  success: boolean
}

interface Pagination {
  page: number
  size: number
  total: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  keyword: string
}

const pagination = ref<Pagination>({
  page: 1,
  size: 10,
  total: 0,
  sortBy: 'id',
  sortOrder: 'asc',
  keyword: ''
})

const data = ref<TektonPipelineRun[]>([])
const selectedRows = ref<TektonPipelineRun[]>([])

const hasKeyword = computed(() => pagination.value.keyword.trim().length > 0)
const filteredData = computed(() => {
  const keyword = pagination.value.keyword.trim().toLowerCase()
  if (!keyword) return data.value
  return data.value.filter(item => {
    const name = item.name?.toLowerCase() || ''
    const namespace = item.namespace?.toLowerCase() || ''
    return name.includes(keyword) || namespace.includes(keyword)
  })
})
const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  return filteredData.value.slice(start, start + pagination.value.size)
})

watch(
  () => pagination.value.keyword,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      pagination.value.page = 1
    }
  }
)

const fetchTektonPipelineRuns = async () => {
  try {
    const response = await getTektonPipelineRuns() as ApiResponse<TektonPipelineRun[]>
    data.value = response.data ?? []
    pagination.value.total = data.value.length
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

const refreshClick = () => {
  fetchTektonPipelineRuns()
}

const handleSelectionChange = (rows: TektonPipelineRun[]) => {
  selectedRows.value = rows
}

const handleDelete = async (pipelineRunName: string) => {
  try {
    await ElMessageBox.confirm(
      `此操作将永久删除 Tekton PipelineRun ${pipelineRunName}，是否继续？`,
      '提示',
      {
        confirmButtonText: '确 认',
        cancelButtonText: '取 消',
        type: 'warning'
      }
    )
    const response = await deleteTektonPipelineRun(pipelineRunName) as ApiResponse
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: "error" })
      return
    }
    fetchTektonPipelineRuns()
    message('数据删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      message(error instanceof Error ? error.message : '删除操作出错', { type: "error" })
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000 })
    }
  }
}

const handleBatchDelete = async () => {
  if (!selectedRows.value.length) {
    message('请先选择要删除的数据', { type: "warning" })
    return
  }
  const names = selectedRows.value.map(item => item.name)
  try {
    await ElMessageBox.confirm(
      `此操作将永久删除选中的 ${names.length} 条 PipelineRun，是否继续？`,
      '提示',
      {
        confirmButtonText: '确 认',
        cancelButtonText: '取 消',
        type: 'warning'
      }
    )
    const response = await deleteTektonPipelineRuns(names) as ApiResponse
    if (!response.success) {
      message(`批量删除失败. 错误信息: ${response.msg}`, { type: "error" })
      return
    }
    fetchTektonPipelineRuns()
    message('批量删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      message(error instanceof Error ? error.message : '删除操作出错', { type: "error" })
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000 })
    }
  }
}

fetchTektonPipelineRuns()
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
      <el-button
        v-if="selectedRows.length"
        type="danger"
        plain
        style="margin-left: 5px;"
        @click="handleBatchDelete"
      >
        <el-icon><Minus /></el-icon>
        <span>批量删除</span>
      </el-button>
    </div>

    <el-table :data="pagedData" stripe @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column fixed prop="name" label="名称" min-width="200"></el-table-column>
      <el-table-column prop="namespace" label="命名空间"></el-table-column>
      <el-table-column prop="succeeded" label="状态" width="110">
        <template #default="scope">
          <el-tag :type="String(scope.row.succeeded).toLowerCase() === 'true' ? 'success' : 'danger'">
            {{ String(scope.row.succeeded).toLowerCase() === 'true' ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因"></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170"></el-table-column>
      <el-table-column fixed="right" label="操作" width="60">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="handleDelete(scope.row.name)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="filteredData.length"
      style="float: right;"
    />

  </div>
</template>

<style scoped lang="scss">
</style>
