<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  getTektonPipelines,
  getTektonPipeline,
  createTektonPipeline,
  updateTektonPipeline,
  deleteTektonPipeline
} from '@/api/dragon'
import { message } from "@/utils/message"
import { Plus, Refresh } from "@element-plus/icons-vue"
import { ElMessageBox } from 'element-plus'
import yaml from 'js-yaml'
import YamlEditor from '@/components/YamlEditor/index.vue'

defineOptions({ name: "DRGTektonPipeline" })

interface TektonPipeline {
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

const data = ref<TektonPipeline[]>([])
const yamlContent = ref<string>('')
const dialogVisible = ref<boolean>(false)
const dialogStatus = ref<'create' | 'update'>('create')
const name = ref<string>('')

const hasKeyword = computed(() => pagination.value.keyword.trim().length > 0)

let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => ({
    page: pagination.value.page,
    size: pagination.value.size,
    keyword: pagination.value.keyword
  }),
  (newVal, oldVal) => {
    if (newVal.keyword !== oldVal.keyword) {
      pagination.value.page = 1
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        fetchTektonPipelines()
      }, 800)
    } else if (newVal.page !== oldVal.page || newVal.size !== oldVal.size) {
      fetchTektonPipelines()
    }
  },
  { deep: true }
)

const fetchTektonPipelines = async () => {
  try {
    const response = await getTektonPipelines({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword
    }) as ApiResponse<TektonPipeline[]>
    data.value = response.data ?? []
    if (response.pagination) {
      pagination.value.total = response.pagination.total
    } else if (!hasKeyword.value) {
      pagination.value.total = data.value.length
    }
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

const refreshClick = () => {
  fetchTektonPipelines()
}

const jsonToYaml = (jsonData: any) => {
  try {
    return yaml.dump(jsonData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      skipInvalid: true
    })
  } catch (error) {
    console.error('JSON 转 YAML 失败:', error)
    return ''
  }
}

const handleYamlClick = (row: TektonPipeline) => {
  name.value = row.name
  dialogStatus.value = 'update'
  fetchTektonPipelineYaml(row.name)
  dialogVisible.value = true
}

const fetchTektonPipelineYaml = async (pipelineName: string) => {
  try {
    const response = await getTektonPipeline(pipelineName) as ApiResponse<Record<string, any>>
    yamlContent.value = jsonToYaml(response.data)
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

const handleCreateClick = () => {
  dialogStatus.value = 'create'
  name.value = ''
  yamlContent.value = ''
  dialogVisible.value = true
}

const handleSubmit = async (operation: 'create' | 'update') => {
  try {
    const jsonData = yaml.load(yamlContent.value)
    if (operation === 'create' && !name.value) {
      name.value = (jsonData as any)?.metadata?.name || ''
    }

    const response = operation === 'create'
      ? await createTektonPipeline(jsonData as object) as ApiResponse
      : await updateTektonPipeline(name.value, jsonData as object) as ApiResponse

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`, {
        type: "error"
      })
      return
    }

    dialogVisible.value = false
    fetchTektonPipelines()
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: "success" })
  } catch (error) {
    if (error !== 'cancel') {
      message(error instanceof Error ? error.message : '操作失败', { type: "error" })
    }
  }
}

const handleDelete = async (pipelineName: string) => {
  try {
    await ElMessageBox.confirm(
      `此操作将永久删除 Tekton Pipeline ${pipelineName}，是否继续？`,
      '提示',
      {
        confirmButtonText: '确 认',
        cancelButtonText: '取 消',
        type: 'warning'
      }
    )
    const response = await deleteTektonPipeline(pipelineName) as ApiResponse
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: "error" })
      return
    }
    fetchTektonPipelines()
    message('数据删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      message(error instanceof Error ? error.message : '删除操作出错', { type: "error" })
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000 })
    }
  }
}

fetchTektonPipelines()
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-button type="primary" plain style="margin-left: 5px;" @click="handleCreateClick">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column fixed prop="name" label="名称"></el-table-column>
      <el-table-column prop="namespace" label="命名空间"></el-table-column>
      <el-table-column prop="createdAt" label="创建时间"></el-table-column>
      <el-table-column fixed="right" label="操作" width="160">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="handleYamlClick(scope.row)">
            编辑 YAML
          </el-button>
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
      :total="pagination.total"
      style="float: right;"
    />

    <el-dialog title="YAML" v-model="dialogVisible" width="60%">
      <el-form>
        <YamlEditor v-model="yamlContent" style="height: 550px"/>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="dialogStatus==='create'?handleSubmit('create'):handleSubmit('update')">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
</style>
