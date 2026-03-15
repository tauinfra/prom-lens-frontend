<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { getUsers, createUser, deleteUser, updateUser, getRoles, getUserRoles, updateUserRoles, getMenus, getUserMenus, updateUserMenus, userResetPassword } from '@/api/authn'
import { getClusters, getNamespaces, getK8sUserPermissions, batchK8sUserPermissions } from '@/api/kubernetes'
import { message } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({ name: "AuthnUser" })

// -------------------------------
// 类型定义
// -------------------------------
interface User {
  id: number
  username: string
  password: string
  email: string
  isActive?: boolean
  isSuperuser?: boolean
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
  debounceTime: 800,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

// 表格数据
const data = ref<User[]>([])

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const roleDrawerVisible = ref(false)
const resetPwdDialogVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const resetPwdFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()
const currentUser = ref<User | null>(null)
const roleOptions = ref<Array<{ id: number; name: string }>>([])
const roleTargetKeys = ref<number[]>([])
const userRoleCache = reactive<Record<number, number[]>>({})
const authDrawerTab = ref<'role' | 'menu' | 'k8s'>('role')
interface MenuItem { id: number; parentId?: number; name: string; title: string; children?: MenuItem[] }
const menuOptions = ref<MenuItem[]>([])
const menuTreeData = ref<MenuItem[]>([])
const menuCheckedKeys = ref<number[]>([])
const userMenuCache = reactive<Record<number, number[]>>({})
const menuTreeRef = ref()

// -------------------------------
// K8s 权限（仅 UI 侧配置）
// -------------------------------
interface K8sCluster { id: number; name: string }
interface K8sNamespace { name: string }
type K8sPermission = 'val:viewer' | 'val:developer' | 'val:admin' | 'val:operator'
interface K8sPermRow {
  key: string
  clusterId?: number
  namespaces?: string[]
  permission?: K8sPermission
}

/** 后端返回的单条：userID + clusterID + 单 namespace + role，转为表格行时按 (clusterID, role) 聚合 namespaces */
interface K8sUserPermissionBackend {
  id: number
  userID: number
  username?: string
  clusterID: number
  clusterName?: string
  namespace: string
  role: string
  creator?: string
  createdAt?: string
  updatedAt?: string
}

/** 将后端列表按 (clusterID, role) 聚合为表格行 */
function backendListToK8sPermRows(list: K8sUserPermissionBackend[]): K8sPermRow[] {
  const map = new Map<string, { clusterId: number; namespaces: string[]; permission: string }>()
  for (const item of list) {
    const key = `${item.clusterID}-${item.role}`
    const existing = map.get(key)
    if (existing) {
      if (!existing.namespaces.includes(item.namespace)) existing.namespaces.push(item.namespace)
    } else {
      map.set(key, {
        clusterId: item.clusterID,
        namespaces: [item.namespace],
        permission: item.role
      })
    }
  }
  return Array.from(map.entries()).map(([k, v]) => ({
    key: `backend-${k}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clusterId: v.clusterId,
    namespaces: v.namespaces,
    permission: v.permission as K8sPermission
  }))
}

const k8sClusterOptions = ref<K8sCluster[]>([])
const k8sNamespaceCache = reactive<Record<number, K8sNamespace[]>>({})
const k8sPermRows = ref<K8sPermRow[]>([])
const userK8sPermCache = reactive<Record<number, K8sPermRow[]>>({})

function newK8sPermRow(): K8sPermRow {
  return { key: `${Date.now()}-${Math.random().toString(16).slice(2)}`, namespaces: [] }
}

async function ensureNamespacesLoaded(clusterId: number) {
  if (!clusterId) return
  if (k8sNamespaceCache[clusterId]) return
  const res = await (getNamespaces(clusterId) as Promise<ApiResponse<K8sNamespace[]>>)
  if (res?.success) {
    k8sNamespaceCache[clusterId] = res.data ?? []
  } else {
    k8sNamespaceCache[clusterId] = []
  }
}

function addK8sPermRow() {
  k8sPermRows.value.push(newK8sPermRow())
}

function removeK8sPermRow(index: number) {
  k8sPermRows.value.splice(index, 1)
}

async function handleK8sClusterChange(row: K8sPermRow) {
  row.namespaces = []
  if (row.clusterId) await ensureNamespacesLoaded(row.clusterId)
}

/** 命名空间互斥：选「所有命名空间」则只保留 *；选具体命名空间则去掉 * */
function handleK8sNamespacesChange(row: K8sPermRow, val: string[]) {
  if (!Array.isArray(val)) return
  if (val.includes('*')) {
    row.namespaces = ['*']
  } else {
    row.namespaces = val.filter(n => n !== '*')
  }
}

// 表单数据
const dataForm = reactive<Omit<User, 'id' | 'createAt' | 'updatedAt'>>({
  username: undefined,
  password: undefined,
  email: undefined,
})

const resetPwdForm = reactive<{ newPassword: string }>({
  newPassword: ''
})

// 表单校验规则
const rules = reactive<FormRules>({
  username: [{ required: true, message: '请输入用户账号.', trigger: 'blur' }],
  password: [{ required: dialogStatus.value === 'create', message: '请输入用户密码.', trigger: 'blur' }],
  email: [{ required: true, message: '请输入用户邮箱.', trigger: 'blur' }],
})

const resetPwdRules = reactive<FormRules>({
  newPassword: [{ required: true, message: '请输入新密码.', trigger: 'blur' }]
})

// dialog 标题映射
const textMap = { update: '更新用户', create: '创建用户' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchCredentials(p: Pagination) {
  try {
    const response = await getUsers({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<User[]> & { code?: number; list?: User[]; total?: number; data?: User[] | { list?: User[]; total?: number } }
    const ok = response.success === true || response.code === 0
    const raw = response.data
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && Array.isArray((raw as { list?: unknown[] }).list))
        ? (raw as { list: unknown[] }).list
        : Array.isArray(response.list)
          ? response.list
          : []
    const total =
      response.pagination?.total ??
      (raw && typeof raw === 'object' && typeof (raw as { total?: number }).total === 'number')
        ? (raw as { total: number }).total
        : response.total ?? list.length
    if (ok || list.length > 0) {
      const rawList = list as Array<User & { is_active?: boolean; is_superuser?: boolean }>
      data.value = rawList.map((item) => ({
        ...item,
        isActive: item.isActive ?? item.is_active,
        isSuperuser: item.isSuperuser ?? item.is_superuser
      }))
      pagination.value.total = Number(total)
      return
    }
    if (response.msg) message(response.msg)
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
function normalizeNestedMenus(list: Array<MenuItem & { parent_id?: number }>): MenuItem[] {
  return list.map(item => ({
    id: item.id,
    parentId: item.parentId ?? item.parent_id,
    name: item.name,
    title: item.title ?? item.name,
    children: item.children?.length ? normalizeNestedMenus(item.children as Array<MenuItem & { parent_id?: number }>) : undefined
  }))
}

function buildFlatMenusTree(flat: Array<MenuItem & { parent_id?: number }>): MenuItem[] {
  const map = new Map<number, MenuItem & { children: MenuItem[] }>()
  flat.forEach(item => {
    map.set(item.id, {
      id: item.id,
      parentId: item.parentId ?? item.parent_id,
      name: item.name,
      title: item.title ?? item.name,
      children: []
    })
  })
  const roots: Array<MenuItem & { children: MenuItem[] }> = []
  flat.forEach(item => {
    const node = map.get(item.id)!
    const pid = item.parentId ?? item.parent_id
    if (pid == null) roots.push(node)
    else if (map.has(pid)) map.get(pid)!.children.push(node)
    else roots.push(node)
  })
  const sortTree = (nodes: Array<MenuItem & { children: MenuItem[] }>) => {
    nodes.sort((a, b) => a.id - b.id)
    nodes.forEach(child => sortTree(child.children as Array<MenuItem & { children: MenuItem[] }>))
  }
  sortTree(roots)
  return roots
}

function buildMenuTree(list: Array<MenuItem & { parent_id?: number }>): MenuItem[] {
  if (!Array.isArray(list) || list.length === 0) return []
  const hasNestedChildren = list.some(item => Array.isArray(item.children) && item.children.length > 0)
  return hasNestedChildren ? normalizeNestedMenus(list) : buildFlatMenusTree(list)
}

function collectMenuIds(list: Array<{ id: number; children?: any[] }>): number[] {
  const ids: number[] = []
  const walk = (nodes: Array<{ id: number; children?: any[] }>) => {
    nodes.forEach(node => {
      ids.push(node.id)
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children as Array<{ id: number; children?: any[] }>)
      }
    })
  }
  walk(list)
  return ids
}

function getAllIdsUnder(node: MenuItem): number[] {
  return [node.id, ...(node.children ?? []).flatMap(getAllIdsUnder)]
}

/** 从树中收集某节点的所有后代 id（不含自身） */
function getDescendantIds(nodes: MenuItem[], targetId: number): number[] {
  for (const n of nodes) {
    if (n.id === targetId) {
      if (!n.children?.length) return []
      return (n.children ?? []).flatMap(c => getAllIdsUnder(c))
    }
    const inChild = getDescendantIds(n.children ?? [], targetId)
    if (inChild.length) return inChild
  }
  return []
}

/** 从已选 id 列表中筛出「最小勾选集」：只保留没有后代在列表中的节点，避免恢复时父节点导致整棵子树显示全选 */
function getMinimalCheckedKeys(selectedIds: number[]): number[] {
  const set = new Set(selectedIds)
  return selectedIds.filter(id => {
    const descendants = getDescendantIds(menuTreeData.value, id)
    return !descendants.some(d => set.has(d))
  })
}

onMounted(async () => {
  refresh()
  roleOptions.value = await fetchList<{ id: number; name: string }>(() => getRoles({ page: 1, size: 100 }))
  const menus = await fetchList<MenuItem>(() => getMenus({ page: 1, size: 1000 }))
  menuOptions.value = menus
  menuTreeData.value = buildMenuTree(menus)
  const clustersRes = await (getClusters({ page: 1, size: 1000 }) as Promise<ApiResponse<K8sCluster[]>>)
  if (clustersRes?.success) k8sClusterOptions.value = clustersRes.data ?? []
})

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    username: undefined,
    password: undefined,
    email: undefined,
  })
  nextTick(() => dataFormRef.value?.clearValidate())
}

const resetPwdFormReset = () => {
  resetPwdForm.newPassword = ''
  nextTick(() => resetPwdFormRef.value?.clearValidate())
}

const handleDialogClosed = () => dataFormRef.value?.clearValidate()
const handleResetPwdDialogClosed = () => resetPwdFormRef.value?.clearValidate()

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
      ? await createUser(dataForm) as ApiResponse<Credential>
      : await updateUser(rowId!, dataForm) as ApiResponse<Credential>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败: ${response.msg}`, { type: 'error' })
      return
    }
    refresh()
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: 'success' })
  } catch (error) {
    message(error instanceof Error ? error.message : '操作失败', { type: 'error' })
  } finally {
    dialogFormVisible.value = false // 关闭弹窗
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

    const response = await deleteUser(rowId) as ApiResponse<void>
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
const editClick = (row: User) => { currentEditId.value = row.id; Object.assign(dataForm, row); dialogStatus.value = 'update'; dialogFormVisible.value = true }
const roleClick = async (row: User) => {
  currentEditId.value = row.id
  currentUser.value = row
  if (!userRoleCache[row.id]) {
    const userRoles = await fetchList<{ id: number }>(() => getUserRoles(row.id, { page: 1, size: 100 }))
    userRoleCache[row.id] = userRoles.map((item) => item.id)
  }
  roleTargetKeys.value = userRoleCache[row.id] ? [...userRoleCache[row.id]] : []
  if (!userMenuCache[row.id]) {
    const userMenus = await fetchList<{ id: number }>(() => getUserMenus(row.id, { page: 1, size: 1000 }))
    userMenuCache[row.id] = collectMenuIds(userMenus as Array<{ id: number; children?: any[] }>)
  }
  menuCheckedKeys.value = userMenuCache[row.id] ? [...userMenuCache[row.id]] : []

  // K8s 权限：优先从后端 GET /api/v1/kubernetes/permissions 拉取（按 userID 筛选），转成表格行；失败则用本地缓存
  try {
    const res = await getK8sUserPermissions({ userID: row.id }) as ApiResponse<K8sUserPermissionBackend[]>
    const list = (res?.data ?? []).filter((item: K8sUserPermissionBackend) => item.userID === row.id)
    k8sPermRows.value = list.length > 0 ? backendListToK8sPermRows(list) : [newK8sPermRow()]
  } catch {
    k8sPermRows.value = (userK8sPermCache[row.id] ?? []).map(item => ({
      ...item,
      key: newK8sPermRow().key,
      namespaces: item.namespaces ? [...item.namespaces] : []
    }))
    if (k8sPermRows.value.length === 0) k8sPermRows.value = [newK8sPermRow()]
  }
  await Promise.all(
    k8sPermRows.value
      .map(r => r.clusterId)
      .filter((id): id is number => typeof id === 'number')
      .map(id => ensureNamespacesLoaded(id))
  )

  authDrawerTab.value = 'role'
  roleDrawerVisible.value = true
  nextTick(() => {
    const minimalKeys = getMinimalCheckedKeys(menuCheckedKeys.value)
    menuTreeRef.value?.setCheckedKeys(minimalKeys)
  })
}
const resetPwdClick = (row: User) => {
  currentEditId.value = row.id
  currentUser.value = row
  resetPwdFormReset()
  resetPwdDialogVisible.value = true
}

const handleResetPwdSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  if (currentEditId.value === undefined) return
  try {
    await formEl.validate()
    const response = await userResetPassword(currentEditId.value, {
      newPassword: resetPwdForm.newPassword
    }) as ApiResponse<void>
    if (!response.success) {
      message(`重置密码失败: ${response.msg}`, { type: 'error' })
      return
    }
    message('重置密码成功!', { type: 'success' })
    resetPwdDialogVisible.value = false
  } catch (error) {
    message(error instanceof Error ? error.message : '操作失败', { type: 'error' })
  }
}
const handleRoleConfirm = async () => {
  if (currentEditId.value === undefined) return
  const tab = authDrawerTab.value
  try {
    if (tab === 'role') {
      await updateUserRoles(currentEditId.value, { roles: roleTargetKeys.value })
      userRoleCache[currentEditId.value] = [...roleTargetKeys.value]
    } else if (tab === 'menu') {
      const checked = menuTreeRef.value?.getCheckedKeys() ?? []
      const halfChecked = menuTreeRef.value?.getHalfCheckedKeys() ?? []
      const menuIds = [...checked, ...halfChecked] as number[]
      await updateUserMenus(currentEditId.value, { menus: menuIds })
      userMenuCache[currentEditId.value] = menuIds
    } else if (tab === 'k8s') {
      const k8sRows = k8sPermRows.value.filter(
        r => typeof r.clusterId === 'number' && !!r.namespaces?.length && !!r.permission
      )
      const clusterMap = new Map<number, Array<{ namespace: string; role: string }>>()
      for (const r of k8sRows) {
        const bindings = (r.namespaces ?? []).map(ns => ({ namespace: ns, role: r.permission! }))
        const existing = clusterMap.get(r.clusterId!) ?? []
        clusterMap.set(r.clusterId!, [...existing, ...bindings])
      }
      const k8sCreatePayload = {
        userID: currentEditId.value,
        clusters: Array.from(clusterMap.entries()).map(([clusterID, bindings]) => ({ clusterID, bindings }))
      }
      await batchK8sUserPermissions(k8sCreatePayload)
      userK8sPermCache[currentEditId.value] = k8sPermRows.value
        .filter(r => typeof r.clusterId === 'number' && !!r.namespaces?.length && !!r.permission)
        .map(r => ({
          key: r.key,
          clusterId: r.clusterId,
          namespaces: r.namespaces ? [...r.namespaces] : [],
          permission: r.permission
        })) as K8sPermRow[]
    }
    const successMsg = tab === 'role' ? '角色权限更新成功' : tab === 'menu' ? '菜单更新成功' : 'K8s 权限更新成功'
    message(successMsg, { type: 'success' })
    roleDrawerVisible.value = false
  } catch (error) {
    const failMsg = tab === 'role' ? '角色权限更新失败' : tab === 'menu' ? '菜单更新失败' : 'K8s 权限更新失败'
    message(error instanceof Error ? error.message : failMsg, { type: 'error' })
  }
}
const refreshClick = () => refresh()

watch(authDrawerTab, (tab) => {
  if (tab === 'menu') {
    nextTick(() => {
      const minimalKeys = getMinimalCheckedKeys(menuCheckedKeys.value)
      menuTreeRef.value?.setCheckedKeys(minimalKeys)
    })
  }
})
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <Perms value="permission:user:create">
        <el-button type="primary" plain @click="addClick">
          <el-icon><Plus /></el-icon>
          <span>新 增</span>
        </el-button>
      </Perms>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="username" label="用户账号" width="140"></el-table-column>
      <el-table-column prop="email" label="用户邮箱"></el-table-column>
      <el-table-column prop="isActive" label="用户状态">
        <template #default="{ row }">
          <IconifyIconOnline
            v-if="row.isActive"
            icon="mdi:check-circle"
            class="status-icon status-icon--ok"
          />
          <IconifyIconOnline
            v-else
            icon="mdi:close-circle"
            class="status-icon status-icon--no"
          />
        </template>
      </el-table-column>
      <el-table-column prop="isSuperuser" label="管理员状态">
        <template #default="{ row }">
          <IconifyIconOnline
            v-if="row.isSuperuser"
            icon="mdi:check-circle"
            class="status-icon status-icon--ok"
          />
          <IconifyIconOnline
            v-else
            icon="mdi:close-circle"
            class="status-icon status-icon--no"
          />
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="创建人"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="170">
        <template #default="scope">
          {{ formatDate(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="220">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="roleClick(scope.row)">
            授权
          </el-button>
          <el-button link type="primary" size="small" @click="resetPwdClick(scope.row)">
            重置密码
          </el-button>
          <el-button link type="primary" size="small" @click="editClick(scope.row)">
            编辑
          </el-button>
          <Perms value="permission:user:delete">
            <el-button link type="primary" size="small" @click="handleDelete(scope.row.id)">
              删除
            </el-button>
          </Perms>
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
        <el-form-item label="用户账号" prop="username" :label-width="formLabelWidth">
          <el-input v-model="dataForm.username" placeholder="请输入用户账号"/>
        </el-form-item>
        <el-form-item v-if="dialogStatus === 'create'" label="用户密码" prop="password" :label-width="formLabelWidth">
          <el-input v-model="dataForm.password" placeholder="请输入用户密码"/>
        </el-form-item>
        <el-form-item label="用户邮箱" prop="email" :label-width="formLabelWidth">
          <el-input v-model="dataForm.email" placeholder="请输入用户邮箱"/>
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

    <el-dialog title="重置密码" v-model="resetPwdDialogVisible" width="40%" @closed="handleResetPwdDialogClosed">
      <el-form ref="resetPwdFormRef" :model="resetPwdForm" :rules="resetPwdRules">
        <el-form-item label="用户账号" :label-width="formLabelWidth">
          <el-input :model-value="currentUser?.username" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword" :label-width="formLabelWidth">
          <el-input v-model="resetPwdForm.newPassword" type="password" show-password placeholder="请输入新密码"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="resetPwdDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleResetPwdSubmit(resetPwdFormRef)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="roleDrawerVisible" title="授权操作" size="45%" :modal="false" modal-penetrable>
      <el-descriptions class="drawer-role-info" title="授权用户" :column="1" size="large">
        <el-descriptions-item label="用户账号">
          {{ currentUser?.username || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <el-tabs v-model="authDrawerTab" type="border-card" class="auth-drawer-tabs">
        <el-tab-pane label="角色" name="role">
          <div class="permission-title">授权角色</div>
          <el-transfer
            v-model="roleTargetKeys"
            :data="roleOptions"
            :props="{ key: 'id', label: 'name' }"
            :titles="['未选角色', '已选角色']"
            filterable
            filter-placeholder="搜索角色"
          />
        </el-tab-pane>
        <el-tab-pane label="菜单" name="menu">
          <div class="permission-title">授权菜单</div>
          <el-tree
            ref="menuTreeRef"
            :key="currentEditId ?? 0"
            :data="menuTreeData"
            show-checkbox
            node-key="id"
            :default-checked-keys="menuCheckedKeys"
            :props="{ label: 'title', children: 'children' }"
          />
        </el-tab-pane>
        <el-tab-pane label="K8s 权限" name="k8s">
          <el-table :data="k8sPermRows" height="350">
            <el-table-column label="集群">
              <template #default="{ row }">
                <el-select
                  v-model="row.clusterId"
                  placeholder="请选择集群"
                  filterable
                  style="width: 100%"
                  @change="() => handleK8sClusterChange(row)"
                >
                  <el-option
                    v-for="c in k8sClusterOptions"
                    :key="c.id"
                    :label="c.name"
                    :value="c.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="命名空间">
              <template #default="{ row }">
                <el-select
                  v-model="row.namespaces"
                  placeholder="请选择命名空间"
                  filterable
                  style="width: 100%"
                  :disabled="!row.clusterId"
                  multiple
                  collapse-tags
                  @change="(val: string[]) => handleK8sNamespacesChange(row, val)"
                >
                  <el-option
                    label="所有命名空间"
                    value="*"
                    :disabled="row.namespaces?.length > 0 && !row.namespaces?.includes('*')"
                  />
                  <el-option
                    v-for="ns in (row.clusterId ? (k8sNamespaceCache[row.clusterId] ?? []) : [])"
                    :key="ns.name"
                    :label="ns.name"
                    :value="ns.name"
                    :disabled="row.namespaces?.includes('*')"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="权限管理" width="160">
              <template #default="{ row }">
                <el-select v-model="row.permission" placeholder="请选择权限" style="width: 100%">
                  <el-option label="只读用户" value="val:viewer" />
                  <el-option label="开发人员" value="val:developer" />
                  <el-option label="运维人员" value="val:operator" />
                  <el-option label="管理员" value="val:admin" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" fixed="right">
              <template #default="scope">
                <el-button link type="primary" @click="removeK8sPermRow(scope.$index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="k8s-toolbar">
            <el-button type="primary" plain @click="addK8sPermRow">
              <el-icon><Plus /></el-icon>
              <span>添加权限</span>
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="roleDrawerVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleRoleConfirm">
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

.status-icon {
  font-size: 16px;
  vertical-align: middle;
}

.status-icon--ok {
  color: #67c23a;
}

.status-icon--no {
  color: #f56c6c;
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

.auth-drawer-tabs {
  flex-shrink: 0;

  :deep(.el-tabs__header) {
    margin: 0 0 12px;
  }

  :deep(.el-tabs__nav-wrap) {
    overflow: visible;
  }

  :deep(.el-tabs__content) {
    overflow: visible;
  }
}

.k8s-toolbar {
  margin-top: 12px;
}
</style>
