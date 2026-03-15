<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { getScopes, createScope, deleteScope, updateScope, getClusters, getNamespaces, batchDeleteScopes } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message"
import { CascaderProps, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { formatDate } from '@/utils/date'

defineOptions({ name: "KubeScope" })

// -------------------------------
// 类型定义
// -------------------------------
interface Scope {
  id: number
  cluster: string
  namespace: string
  createAt: string
  updatedAt: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination?: { total: number }
  code: number
  msg?: string
  success: boolean
}

// -------------------------------
// 分页（前端分页）
// -------------------------------
const pagination = ref({
  page: 1,
  size: 10,
  total: 0,
  sortBy: 'id',
  sortOrder: 'asc' as 'asc' | 'desc',
  keyword: ''
})

// 表格数据
const data = ref<Scope[]>([])
const selectedScopeIds = ref<number[]>([])

const normalizeSearchValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase()
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeSearchValue(item)).join(' ')
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(item => normalizeSearchValue(item))
      .join(' ')
  }
  return ''
}

const filteredData = computed(() => {
  const kw = (pagination.value.keyword || '').trim().toLowerCase()
  if (!kw) return data.value
  return data.value.filter((row: Scope) =>
    Object.keys(row).some(key =>
      normalizeSearchValue((row as Record<string, unknown>)[key]).includes(kw)
    )
  )
})
const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  return filteredData.value.slice(start, start + pagination.value.size)
})

watch(() => pagination.value.keyword, () => { pagination.value.page = 1 })
watch(filteredData, (val) => { pagination.value.total = val.length }, { immediate: true })
const cascaderValue = ref<string[]>([])

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '120px'
const currentEditId = ref<number>()

// 表单数据
const dataForm = reactive<Omit<Scope, 'id' | 'createAt' | 'updatedAt'>>({
  cluster: undefined,
  namespace: undefined,
})

// 表单校验规则
const rules = reactive<FormRules>({
  cluster: [{ required: true, message: '请选择集群.', trigger: 'blur' }],
  namespace: [{ required: true, message: '请选择命名空间.', trigger: 'blur' }],
})

// dialog 标题映射
const textMap = { update: '更新授权范围', create: '创建授权范围' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchScopes() {
  try {
    const response = await getScopes({
      page: 1,
      size: 9999,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: '',
    }) as ApiResponse<Scope[]>
    data.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const refresh = () => fetchScopes()

const cascaderProps: CascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, data } = node
    try {
      if (level === 0) {
        const response = await getClusters({ page: 1, size: 100 }) as ApiResponse<Array<{ id: number; name: string }>>
        const clusters = response.data ?? []
        resolve([
          { value: '*', label: '所有集群', leaf: true },
          ...clusters.map(cluster => ({
            value: String(cluster.id),
            label: cluster.name,
            leaf: false
          }))
        ])
      } else if (level === 1) {
        const clusterId = data.value
        const response = await getNamespaces(Number(clusterId)) as ApiResponse<Array<{ name: string }>>
        const namespaces = response.data ?? []
        resolve(namespaces.map(ns => ({
          value: ns.name,
          label: ns.name,
          leaf: true
        })))
      } else {
        resolve([])
      }
    } catch (error) {
      showApiError(error)
      resolve([])
    }
  }
}

const handleCascaderChange = (value: string[]) => {
  if (value && value.length === 1 && value[0] === '*') {
    dataForm.cluster = '*'
    dataForm.namespace = '*'
  } else if (value && value.length === 2) {
    dataForm.cluster = value[0]
    dataForm.namespace = value[1]
  } else {
    dataForm.cluster = undefined
    dataForm.namespace = undefined
  }
}

// -------------------------------
// 生命周期
// -------------------------------
onMounted(() => { refresh() })

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    cluster: undefined,
    namespace: undefined,
  })
  cascaderValue.value = []
  nextTick(() => dataFormRef.value?.clearValidate())
}

const handleDialogClosed = () => dataFormRef.value?.clearValidate()

const handleFormSubmit = async (
  formEl: FormInstance | undefined,
  operation: 'create' | 'update',
  rowId?: number
) => {
  if (!formEl) return
  if (operation === 'update' && rowId === undefined) return

  try {
    await formEl.validate()
    const response = operation === 'create'
      ? await createScope(dataForm) as ApiResponse<Scope>
      : await updateScope(rowId!, dataForm) as ApiResponse<Scope>

    if (!response.success) {
      showApiError(`数据${operation === 'create' ? '添加' : '更新'}失败: ${response.msg}`)
      return
    }
    refresh()
    dialogFormVisible.value = false
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: 'success' })
  } catch (error) {
    showApiError(error)
  }
}

const createForm = (formEl: FormInstance | undefined) => handleFormSubmit(formEl, 'create')
const updateForm = (formEl: FormInstance | undefined, rowId?: number) => handleFormSubmit(formEl, 'update', rowId)

const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要执行删除操作吗？',
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    const response = await deleteScope(rowId) as ApiResponse<void>
    if (!response.success) {
      showApiError(`删除失败: ${response.msg}`)
      return
    }
    refresh();
    message('数据删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') showApiError(error)
    else message('已取消删除操作!', { type: 'info', duration: 5000 })
  }
}

const handleSelectionChange = (selection: Scope[]) => {
  selectedScopeIds.value = selection.map(item => item.id).filter(id => typeof id === 'number')
}

const handleBatchDelete = async () => {
  if (selectedScopeIds.value.length === 0) {
    message('请先选择要删除的数据', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedScopeIds.value.length} 条数据，此操作不可撤销，确定要执行删除操作吗？`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await batchDeleteScopes({ ids: selectedScopeIds.value }) as ApiResponse<void>
    if (!response.success) {
      showApiError(`批量删除失败: ${response.msg}`)
      return
    }
    selectedScopeIds.value = []
    refresh()
    message('批量删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') showApiError(error)
    else message('已取消批量删除操作!', { type: 'info', duration: 5000 })
  }
}

const addClick = () => { dialogStatus.value = 'create'; resetForm(); dialogFormVisible.value = true }
const editClick = (row: Scope) => {
  currentEditId.value = row.id
  Object.assign(dataForm, row)
  cascaderValue.value = row.cluster === '*' ? ['*'] : [String(row.cluster), row.namespace]
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
}
const refreshClick = () => refresh()
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-button type="primary" plain @click="addClick">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
      <el-button
        v-show="selectedScopeIds.length > 0"
        type="danger"
        plain
        style="margin-left: 5px;"
        @click="handleBatchDelete"
      >
        <el-icon><Delete /></el-icon>
        <span>批量删除</span>
      </el-button>
    </div>

    <el-table :data="pagedData" stripe @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column prop="cluster" label="集群">
        <template #default="{ row }">
          {{ row.clusterName || row.cluster || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="namespace" label="命名空间"></el-table-column>
      <el-table-column prop="creator" label="创建人"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间">
        <template #default="scope">
          {{ formatDate(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="100">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="editClick(scope.row)">
            编辑
          </el-button>
          <el-button link type="primary" size="small" @click="handleDelete(scope.row.id)">
            删除
          </el-button>
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

    <!-- 表单操作 -->
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="集群/命名空间" prop="cluster" :label-width="formLabelWidth">
          <el-cascader
            v-model="cascaderValue"
            :props="cascaderProps"
            @change="handleCascaderChange"
            placeholder="选择集群 / 命名空间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogFormVisible = false">取 消</el-button>
          <el-button type="primary" @click="dialogStatus==='create'?createForm(dataFormRef):updateForm(dataFormRef, currentEditId)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
</style>
