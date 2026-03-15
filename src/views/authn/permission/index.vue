<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import {
  getPermissions,
  createPermission,
  deletePermission,
  updatePermission,
} from '@/api/authn'
import { message } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({ name: "AuthnPermission" })

// -------------------------------
// 类型定义
// -------------------------------
interface Permission {
  id: number
  name: string
  code: string
  createAt: string
  updatedAt: string
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
const { pagination, refresh } = usePaginatedSearch(fetchPermissions, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

// 表格数据
const data = ref<Permission[]>([])

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

// 表单数据
const dataForm = reactive<Omit<Permission, 'id' | 'createAt' | 'updatedAt'>>({
  name: undefined,
  code: undefined,
})

// 表单校验规则
const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入权限名称.', trigger: 'blur' }],
  code: [{ required: true, message: '请输入权限标识.', trigger: 'blur' }],
})

// dialog 标题映射
const textMap = { update: '更新权限', create: '创建权限' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchPermissions(p: Pagination) {
  try {
    const response = await getPermissions({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Permission[]>
    data.value = response.data ?? []
    pagination.value.total = response.pagination?.total ?? 0
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

// 通用 fetch 函数
async function fetchList<T>(apiCall: () => Promise<{ data?: T[] }>, fallback: T[] = []): Promise<T[]> {
  try {
    const res = await apiCall()
    return res.data || fallback
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败")
    return fallback
  }
}

// -------------------------------
// 生命周期
// -------------------------------
onMounted(async () => {
  refresh()
})

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    name: undefined,
    code: undefined,
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
      ? await createPermission(dataForm) as ApiResponse<Permission>
      : await updatePermission(rowId!, dataForm) as ApiResponse<Permission>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败: ${response.msg}`, { type: 'error' })
      return
    }
    refresh()
    dialogFormVisible.value = false
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: 'success' })
  } catch (error) {
    message(error instanceof Error ? error.message : '操作失败', { type: 'error' })
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

    const response = await deletePermission(rowId) as ApiResponse<void>
    if (!response.success) {
      message(`删除失败: ${response.msg}`, { type: 'error' })
      return
    }
    refresh();
    message('数据删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') message(`删除操作出错: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' })
    else message('已取消删除操作!', { type: 'info', duration: 5000 })
  }
}

const addClick = () => { dialogStatus.value = 'create'; resetForm(); dialogFormVisible.value = true }
const editClick = (row: Permission) => { currentEditId.value = row.id; Object.assign(dataForm, row); dialogStatus.value = 'update'; dialogFormVisible.value = true }
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
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="name" label="权限名称"></el-table-column>
      <el-table-column prop="code" label="权限标识"></el-table-column>
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
        <el-form-item label="权限名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name" placeholder="请输入权限名称"/>
        </el-form-item>
        <el-form-item label="权限标识" prop="code" :label-width="formLabelWidth">
          <el-input v-model="dataForm.code" placeholder="请输入权限标识，示例：permission:user:list/create/update/delete"/>
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
