<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from 'vue'
import { getRoles, createRole, deleteRole, updateRole, getPermissions, getRolePermissions, updateRolePermissions } from '@/api/authn'
import { message } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({ name: "AuthnRole" })

// -------------------------------
// 类型定义
// -------------------------------
interface Role {
  id: number
  name: string
  code: string
  description: string
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
const { pagination, refresh } = usePaginatedSearch(fetchCredentials, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

// 表格数据
const data = ref<Role[]>([])

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const permissionDrawerVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()
const currentRole = ref<Role | null>(null)
const permissionOptions = ref<Array<{ id: number; name: string }>>([])
const permissionTargetKeys = ref<number[]>([])
const rolePermissionCache = reactive<Record<number, number[]>>({})
const transferData = computed(() => permissionOptions.value)
const loadRolePermissions = async (roleId: number) => {
  if (rolePermissionCache[roleId]) return
  const rolePermissions = await fetchList<{ id: number }>(() => getRolePermissions(roleId))
  rolePermissionCache[roleId] = rolePermissions.map((item) => item.id)
}

// 表单数据
const dataForm = reactive<Omit<Role, 'id' | 'createAt' | 'updatedAt'>>({
  name: undefined,
  code: undefined,
  description: undefined,
})

// 表单校验规则
const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入角色名称.', trigger: 'blur' }],
  code: [{ required: true, message: '请输入角色编码.', trigger: 'blur' }],
})

// dialog 标题映射
const textMap = { update: '更新角色', create: '创建角色' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchCredentials(p: Pagination) {
  try {
    const response = await getRoles({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Role[]>

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
  permissionOptions.value = await fetchList<{ id: number; name: string }>(() => getPermissions({ page: 1, size: 100 }))
})

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    name: undefined,
    code: undefined,
    type: undefined,
    baseURL: undefined,
    secretType: undefined,
    encryptedSecret: undefined
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
      ? await createRole(dataForm) as ApiResponse<Credential>
      : await updateRole(rowId!, dataForm) as ApiResponse<Credential>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败: ${response.msg}`, { type: 'error', duration: 5000 })
      return
    }
    refresh()
    dialogFormVisible.value = false
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: 'success', duration: 5000 })
  } catch (error) {
    message(error instanceof Error ? error.message : '操作失败', { type: 'error', duration: 5000 })
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

    const response = await deleteRole(rowId) as ApiResponse<void>
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
const editClick = (row: Role) => { currentEditId.value = row.id; Object.assign(dataForm, row); dialogStatus.value = 'update'; dialogFormVisible.value = true }
const permClick = async (row: Role) => {
  currentEditId.value = row.id
  currentRole.value = row
  await loadRolePermissions(row.id)
  permissionTargetKeys.value = rolePermissionCache[row.id] ? [...rolePermissionCache[row.id]] : []
  permissionDrawerVisible.value = true
}
const handlePermissionConfirm = async () => {
  if (currentEditId.value === undefined) return
  try {
    const response = await updateRolePermissions(currentEditId.value, {
      permissions: permissionTargetKeys.value
    }) as ApiResponse<void>
    if (!response.success) {
      message(`授权更新失败: ${response.msg}`, { type: 'error' })
      return
    }
    rolePermissionCache[currentEditId.value] = [...permissionTargetKeys.value]
    message('授权更新成功!', { type: 'success' })
    permissionDrawerVisible.value = false
  } catch (error) {
    message(error instanceof Error ? error.message : '授权更新失败', { type: 'error' })
  }
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
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="name" label="角色名称"></el-table-column>
      <el-table-column prop="code" label="角色编码"></el-table-column>
      <el-table-column prop="description" label="角色描述" min-width="200"></el-table-column>
      <el-table-column prop="creator" label="创建人"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间">
        <template #default="scope">
          {{ formatDate(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="140">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="permClick(scope.row)">
            授权
          </el-button>
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

    <!-- 编辑表单操作 -->
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="角色名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name" placeholder="请输入角色名称"/>
        </el-form-item>
      <el-form-item label="角色编码" prop="code" :label-width="formLabelWidth">
        <el-input v-model="dataForm.code" placeholder="请输入角色编码"/>
      </el-form-item>
        <el-form-item label="角色描述" prop="description" :label-width="formLabelWidth">
          <el-input v-model="dataForm.description" placeholder="请输入角色描述"/>
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

    <!-- 角色表单操作 -->
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="角色名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name" placeholder="请输入角色名称"/>
        </el-form-item>
      <el-form-item label="角色编码" prop="code" :label-width="formLabelWidth">
        <el-input v-model="dataForm.code" placeholder="请输入角色编码"/>
      </el-form-item>
      <el-form-item label="角色描述" prop="description" :label-width="formLabelWidth">
        <el-input v-model="dataForm.description" placeholder="请输入角色描述"/>
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

    <el-drawer v-model="permissionDrawerVisible" title="授权操作" size="40%" :modal="false" modal-penetrable>
      <el-descriptions class="drawer-role-info" title="授权角色" :column="2" size="large">
        <el-descriptions-item label="角色名称">
          {{ currentRole?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="角色描述">
          {{ currentRole?.description || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <div class="permission-title">权限策略</div>
      <el-transfer
        v-model="permissionTargetKeys"
        :data="transferData"
        :titles="['未选权限策略', '已选权限策略']"
        :props="{ key: 'id', label: 'name' }"
        filterable
        filter-placeholder="搜索权限"
      />
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="permissionDrawerVisible = false">取 消</el-button>
          <el-button type="primary" @click="handlePermissionConfirm">
            确 认
          </el-button>
        </div>
      </template>
    </el-drawer>

  </div>
</template>

<style scoped lang="scss">
.permission-title {
  font-weight: 600;
  margin: 12px 0 16px;
}

.drawer-role-info :deep(.el-descriptions__label) {
  font-weight: 600;
}

.drawer-role-info :deep(.el-descriptions__body) {
  background: #f5f7fa;
  padding: 4px 14px;
  border-radius: 6px;
}

:deep(.drawer-role-info .el-descriptions__cell) {
  padding-bottom: 2px !important;
}
</style>
