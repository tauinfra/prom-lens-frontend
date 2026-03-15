<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { getScopeBindingPermissions, createScopeBindingPermission, deleteScopeBindingPermission, updateScopeBindingPermission, getScopeBindings, getPermissions, batchDeleteScopeBindingPermissions } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { formatDate } from '@/utils/date'

defineOptions({ name: "KubeScopeBindingPermission" })

// -------------------------------
// 类型定义
// -------------------------------
interface ScopeBindingPermission {
  id?: number
  bindingID: number
  permissionID: number
  creator?: string
  createAt: string
  createdAt?: string
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
const data = ref<ScopeBindingPermission[]>([])
const selectedScopeBindingPermissionIds = ref<number[]>([])

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
  return data.value.filter((row: ScopeBindingPermission) =>
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
const bindingOptions = ref<Array<{ id: number; subjectType?: string; subjectName?: string; clusterName?: string; namespace?: string }>>([])
const permissionOptions = ref<Array<{ id: number; name?: string; code?: string; resource?: string; action?: string }>>([])

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

// 表单数据
const dataForm = reactive<Omit<ScopeBindingPermission, 'id' | 'createAt' | 'updatedAt'>>({
  bindingID: undefined,
  permissionID: undefined,
})

// 表单校验规则
const rules = reactive<FormRules>({
  bindingID: [{ required: true, message: '请选择绑定.', trigger: 'blur' }],
  permissionID: [{ required: true, message: '请选择权限.', trigger: 'blur' }],
})

// dialog 标题映射
const textMap = { update: '更新绑定权限', create: '创建绑定权限' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchScopeBindingPermissions() {
  try {
    const response = await getScopeBindingPermissions({
      page: 1,
      size: 9999,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: '',
    }) as ApiResponse<ScopeBindingPermission[]>
    data.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const refresh = () => fetchScopeBindingPermissions()

const fetchBindingOptions = async () => {
  try {
    const response = await getScopeBindings({ page: 1, size: 100 }) as ApiResponse<Array<{ id: number; subjectType?: string; subjectName?: string; clusterName?: string; namespace?: string }>>
    bindingOptions.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const fetchPermissionOptions = async () => {
  try {
    const response = await getPermissions({ page: 1, size: 100 }) as ApiResponse<Array<{ id: number; name?: string; code?: string; resource?: string; action?: string }>>
    permissionOptions.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

// -------------------------------
// 生命周期
// -------------------------------
onMounted(async () => {
  refresh()
  await Promise.all([fetchBindingOptions(), fetchPermissionOptions()])
})

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    bindingID: undefined,
    permissionID: undefined,
  })
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
      ? await createScopeBindingPermission(dataForm) as ApiResponse<ScopeBindingPermission>
      : await updateScopeBindingPermission(rowId!, dataForm) as ApiResponse<ScopeBindingPermission>

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

const handleDelete = async (rowId: number | undefined) => {
  if (rowId === undefined) return
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要执行删除操作吗？',
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    const response = await deleteScopeBindingPermission(rowId) as ApiResponse<void>
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

const handleSelectionChange = (selection: ScopeBindingPermission[]) => {
  selectedScopeBindingPermissionIds.value = selection
    .map(item => item.id)
    .filter((id): id is number => typeof id === 'number')
}

const handleBatchDelete = async () => {
  if (selectedScopeBindingPermissionIds.value.length === 0) {
    message('请先选择要删除的数据', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedScopeBindingPermissionIds.value.length} 条数据，此操作不可撤销，确定要执行删除操作吗？`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await batchDeleteScopeBindingPermissions({ ids: selectedScopeBindingPermissionIds.value }) as ApiResponse<void>
    if (!response.success) {
      showApiError(`批量删除失败: ${response.msg}`)
      return
    }
    selectedScopeBindingPermissionIds.value = []
    refresh()
    message('批量删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') showApiError(error)
    else message('已取消批量删除操作!', { type: 'info', duration: 5000 })
  }
}

const addClick = () => { dialogStatus.value = 'create'; resetForm(); dialogFormVisible.value = true }
const editClick = (row: ScopeBindingPermission) => {
  currentEditId.value = row.id
  Object.assign(dataForm, {
    bindingID: row.bindingID ? Number(row.bindingID) : undefined,
    permissionID: row.permissionID ? Number(row.permissionID) : undefined,
  })
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
        v-show="selectedScopeBindingPermissionIds.length > 0"
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
      <el-table-column prop="subjectType" label="主体">
        <template #default="{ row }">
          [{{ row.subjectType }}] {{ row.subjectName }}
        </template>
      </el-table-column>
      <el-table-column prop="clusterName" label="集群"></el-table-column>
      <el-table-column prop="namespace" label="命名空间"></el-table-column>
      <el-table-column prop="code" label="权限标识"></el-table-column>
      <el-table-column prop="creator" label="创建人" width="120"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="170">
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
        <el-form-item label="绑定" prop="bindingID" :label-width="formLabelWidth">
          <el-select v-model="dataForm.bindingID" placeholder="请选择绑定" filterable clearable>
            <el-option
              v-for="binding in bindingOptions"
              :key="binding.id"
              :label="`${binding.id} - ${binding.subjectType ?? '-'}:${binding.subjectName ?? '-'} | ${binding.clusterName ?? '-'} / ${binding.namespace ?? '-'}`"
              :value="binding.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权限" prop="permissionID" :label-width="formLabelWidth">
          <el-select v-model="dataForm.permissionID" placeholder="请选择权限" filterable clearable>
            <el-option
              v-for="perm in permissionOptions"
              :key="perm.id"
              :label="`${perm.id} - ${perm.name ?? `${perm.resource ?? '-'}:${perm.action ?? '-'}`} (${perm.code ?? '-'})`"
              :value="perm.id"
            />
          </el-select>
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
