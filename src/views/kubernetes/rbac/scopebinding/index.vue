<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed, watch } from 'vue'
import { getScopeBindings, createScopeBinding, deleteScopeBinding, updateScopeBinding, getScopes, getPermissions, batchDeleteScopeBindings } from '@/api/kubernetes'
import { getRoles, getUsers } from '@/api/authn'
import { message, showApiError } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { formatDate } from '@/utils/date'

defineOptions({ name: "KubeScopeBinding" })

// -------------------------------
// 类型定义
// -------------------------------
interface ScopeBinding {
  id: number
  subjectType: 'role' | 'user' | 'group'
  subjectID: number | string
  subjectName?: string
  scopeID: number
  clusterName?: string
  namespace?: string
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
const data = ref<ScopeBinding[]>([])
const selectedScopeBindingIds = ref<number[]>([])

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
  return data.value.filter((row: ScopeBinding) =>
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
const scopeOptions = ref<Array<{ id: number; cluster?: string; clusterName?: string; namespace?: string }>>([])
const roleOptions = ref<Array<{ id: number; name: string }>>([])
const userOptions = ref<Array<{ id: number; username: string }>>([])
const permissionOptions = ref<Array<{ id: number; name?: string; code?: string; resource?: string; action?: string }>>([])
const subjectOptions = computed(() => {
  if (dataForm.subjectType === 'user') return userOptions.value
  if (dataForm.subjectType === 'group') return []
  return roleOptions.value
})

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

// 表单数据
const dataForm = reactive<Omit<ScopeBinding, 'id' | 'createAt' | 'updatedAt'>>({
  subjectType: 'role',
  subjectID: undefined,
  scopeID: undefined,
})

// 表单校验规则
const rules = reactive<FormRules>({
  subjectType: [{ required: true, message: '请选择主体类型.', trigger: 'blur' }],
  subjectID: [{ required: true, message: '请选择主体.', trigger: 'blur' }],
  scopeID: [{ required: true, message: '请选择授权范围.', trigger: 'blur' }],
})

// dialog 标题映射
const textMap = { update: '更新绑定', create: '创建绑定' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchScopeBindings() {
  try {
    const response = await getScopeBindings({
      page: 1,
      size: 9999,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: '',
    }) as ApiResponse<ScopeBinding[]>
    data.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const refresh = () => fetchScopeBindings()

const fetchScopeOptions = async () => {
  try {
    const response = await getScopes({ page: 1, size: 100 }) as ApiResponse<Array<{ id: number; cluster?: string; clusterName?: string; namespace?: string }>>
    scopeOptions.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const fetchRoleOptions = async () => {
  try {
    const response = await getRoles({ page: 1, size: 100 }) as ApiResponse<Array<{ id: number; name: string }>>
    roleOptions.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const fetchUserOptions = async () => {
  try {
    const response = await getUsers({ page: 1, size: 100 }) as ApiResponse<Array<{ id: number; username: string }>>
    userOptions.value = response.data ?? []
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
  await Promise.all([fetchScopeOptions(), fetchRoleOptions(), fetchUserOptions(), fetchPermissionOptions()])
})

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    subjectType: 'role',
    subjectID: undefined,
    scopeID: undefined,
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
      ? await createScopeBinding(dataForm) as ApiResponse<ScopeBinding>
      : await updateScopeBinding(rowId!, dataForm) as ApiResponse<ScopeBinding>

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

    const response = await deleteScopeBinding(rowId) as ApiResponse<void>
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

const handleSelectionChange = (selection: ScopeBinding[]) => {
  selectedScopeBindingIds.value = selection.map(item => item.id).filter(id => typeof id === 'number')
}

const handleBatchDelete = async () => {
  if (selectedScopeBindingIds.value.length === 0) {
    message('请先选择要删除的数据', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedScopeBindingIds.value.length} 条数据，此操作不可撤销，确定要执行删除操作吗？`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await batchDeleteScopeBindings({ ids: selectedScopeBindingIds.value }) as ApiResponse<void>
    if (!response.success) {
      showApiError(`批量删除失败: ${response.msg}`)
      return
    }
    selectedScopeBindingIds.value = []
    refresh()
    message('批量删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') showApiError(error)
    else message('已取消批量删除操作!', { type: 'info', duration: 5000 })
  }
}

const addClick = () => { dialogStatus.value = 'create'; resetForm(); dialogFormVisible.value = true }
const editClick = (row: ScopeBinding) => {
  currentEditId.value = row.id
  Object.assign(dataForm, {
    subjectType: row.subjectType,
    subjectID: row.subjectID !== undefined ? row.subjectID : undefined,
    scopeID: Number(row.scopeID),
  })
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
}
const refreshClick = () => refresh()

watch(() => dataForm.subjectType, () => {
  dataForm.subjectID = undefined
})
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
        v-show="selectedScopeBindingIds.length > 0"
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
      <el-table-column prop="subjectType" label="主体类型">
        <template #default="{ row }">
          [{{ row.subjectType }}] {{ row.subjectName }}
        </template>
      </el-table-column>
      <el-table-column prop="clusterName" label="集群"></el-table-column>
      <el-table-column prop="namespace" label="命名空间"></el-table-column>
      <el-table-column prop="creator" label="创建人"></el-table-column>
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
        <el-form-item label="主体类型" prop="subjectType" :label-width="formLabelWidth">
          <el-radio-group v-model="dataForm.subjectType">
            <el-radio-button label="user">用户</el-radio-button>
            <el-radio-button label="role">角色</el-radio-button>
            <el-radio-button label="group">用户组</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="主体" prop="subjectID" :label-width="formLabelWidth">
          <el-select
            v-model="dataForm.subjectID"
            placeholder="请选择主体"
            filterable
            clearable
            :allow-create="dataForm.subjectType === 'group'"
          >
            <el-option
              v-for="subject in subjectOptions"
              :key="subject.id"
              :label="dataForm.subjectType === 'user'
                ? `${subject.id} - ${subject.username}`
                : `${subject.id} - ${subject.name}`"
              :value="subject.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="授权范围" prop="scopeID" :label-width="formLabelWidth">
          <el-select v-model="dataForm.scopeID" placeholder="请选择授权范围" filterable clearable>
            <el-option
              v-for="scope in scopeOptions"
              :key="scope.id"
              :label="`${scope.id} - cluster:${scope.cluster ?? scope.clusterName ?? '-'} | ns:${scope.namespace ?? '-'}`"
              :value="scope.id"
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
