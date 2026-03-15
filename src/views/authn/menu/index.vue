<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from 'vue'
import {
  getMenus,
  createMenu,
  deleteMenu,
  updateMenu
} from '@/api/authn'
import { message } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({ name: "AuthnMenu" })

interface Menu {
  id: number
  parentId?: number
  name: string
  path: string
  component?: string
  title: string
  icon?: string
  rank?: number
  showParent?: boolean
  showLink?: boolean
  creator?: string
  createdAt?: string
  updatedAt?: string
  children?: Menu[]
}

interface ApiResponse<T = any> {
  data?: T
  pagination?: Pagination
  code: number
  msg?: string
  success: boolean
}

const { pagination, refresh } = usePaginatedSearch(fetchMenus, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

const data = ref<Menu[]>([])
const menuOptions = ref<Menu[]>([])

const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

const dataForm = reactive<Omit<Menu, 'id' | 'createdAt' | 'updatedAt' | 'creator'>>({
  parentId: undefined,
  name: undefined,
  title: undefined,
  path: undefined,
  component: undefined,
  icon: undefined,
  rank: undefined,
  showParent: true,
  showLink: true
})

const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入菜单名称.', trigger: 'blur' }],
  title: [{ required: true, message: '请输入菜单标题.', trigger: 'blur' }],
  path: [{ required: true, message: '请输入路由路径.', trigger: 'blur' }]
})

const textMap = { update: '更新菜单', create: '创建菜单' }

const parentOptions = computed(() =>
  menuOptions.value.filter(item => item.id !== currentEditId.value)
)
const parentData = computed(() =>
  data.value.filter(item => item.parentId == null)
)

const sortMenuTree = (menus: Menu[]): Menu[] => {
  const sorted = [...menus].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id - b.id)
  return sorted.map(item => ({
    ...item,
    children: item.children?.length ? sortMenuTree(item.children) : undefined
  }))
}

const flatMenusToTree = (menus: Menu[]): Menu[] => {
  const map = new Map<number, Menu & { children: Menu[] }>()
  const nodes = menus.map(item => ({ ...item, children: [] as Menu[] }))
  nodes.forEach(node => map.set(node.id, node as Menu & { children: Menu[] }))
  const roots: Array<Menu & { children: Menu[] }> = []
  nodes.forEach(node => {
    if (node.parentId != null && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node as Menu & { children: Menu[] })
    } else {
      roots.push(node as Menu & { children: Menu[] })
    }
  })
  return sortMenuTree(roots)
}

const normalizeMenus = (menus: Menu[]): Menu[] => {
  const hasChildrenField = menus.some(item => Array.isArray(item.children))
  return hasChildrenField ? sortMenuTree(menus) : flatMenusToTree(menus)
}

const flattenMenus = (menus: Menu[]): Menu[] => {
  const result: Menu[] = []
  const loop = (list: Menu[]) => {
    list.forEach(item => {
      result.push({
        ...item,
        children: undefined
      })
      if (item.children?.length) loop(item.children)
    })
  }
  loop(menus)
  return result
}

async function fetchMenus(p: Pagination) {
  try {
    const response = await getMenus({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Menu[]>
    data.value = normalizeMenus(response.data ?? [])
    pagination.value.total = response.pagination?.total ?? 0
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

async function fetchMenuOptions() {
  try {
    const response = await getMenus({
      page: 1,
      size: 1000,
      sortBy: 'id',
      sortOrder: 'asc',
      keyword: ''
    }) as ApiResponse<Menu[]>
    menuOptions.value = flattenMenus(normalizeMenus(response.data ?? []))
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

onMounted(async () => {
  refresh()
  fetchMenuOptions()
})

const resetForm = () => {
  Object.assign(dataForm, {
    parentId: undefined,
    name: undefined,
    title: undefined,
    path: undefined,
    component: undefined,
    icon: undefined,
    rank: undefined,
    showParent: true,
    showLink: true
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
      ? await createMenu(dataForm) as ApiResponse<Menu>
      : await updateMenu(rowId!, dataForm) as ApiResponse<Menu>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败: ${response.msg}`, { type: 'error' })
      return
    }
    refresh()
    fetchMenuOptions()
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

    const response = await deleteMenu(rowId) as ApiResponse<void>
    if (!response.success) {
      message(`删除失败: ${response.msg}`, { type: 'error' })
      return
    }
    refresh()
    fetchMenuOptions()
    message('数据删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') message(`删除操作出错: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' })
    else message('已取消删除操作!', { type: 'info', duration: 5000 })
  }
}

const addClick = () => {
  dialogStatus.value = 'create'
  currentEditId.value = undefined
  resetForm()
  dataForm.parentId = undefined
  dialogFormVisible.value = true
}
const addChildClick = (row: Menu) => {
  dialogStatus.value = 'create'
  currentEditId.value = undefined
  resetForm()
  dataForm.parentId = row.id
  dialogFormVisible.value = true
}
const editClick = (row: Menu) => {
  currentEditId.value = row.id
  Object.assign(dataForm, row)
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
    </div>

    <el-table :data="data" stripe row-key="id" :tree-props="{ children: 'children' }">
      <el-table-column prop="name" label="菜单名称" show-overflow-tooltip min-width="100"></el-table-column>
      <el-table-column prop="title" label="菜单标题"></el-table-column>
      <el-table-column prop="path" show-overflow-tooltip label="路由路径"></el-table-column>
      <el-table-column prop="component" show-overflow-tooltip label="组件路径"></el-table-column>
      <el-table-column prop="rank" label="排序" width="70"></el-table-column>
      <el-table-column prop="showParent" label="显示父级" width="90">
        <template #default="{ row }">
          <el-tag :type="row.showParent ? 'success' : 'info'">
            {{ row.showParent ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="showLink" label="显示菜单" width="90">
        <template #default="{ row }">
          <el-tag :type="row.showLink ? 'success' : 'info'">
            {{ row.showLink ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="创建人" width="120"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="180">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="addChildClick(scope.row)">
            添加子菜单
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

    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right;"
    />

    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="菜单名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
        <el-form-item label="菜单标题" prop="title" :label-width="formLabelWidth">
          <el-input v-model="dataForm.title"/>
        </el-form-item>
        <el-form-item label="菜单图标" prop="icon" :label-width="formLabelWidth">
          <el-input v-model="dataForm.icon" placeholder="例如：mdi:account 或 ~icons/mdi/account"/>
        </el-form-item>
        <el-form-item label="路由路径" prop="path" :label-width="formLabelWidth">
          <el-input v-model="dataForm.path"/>
        </el-form-item>
        <el-form-item label="组件路径" prop="component" :label-width="formLabelWidth">
          <el-input v-model="dataForm.component" placeholder="例如：kubernetes/workload/statefulset/index"/>
        </el-form-item>
        <el-form-item label="排序" prop="rank" :label-width="formLabelWidth">
          <el-input-number v-model="dataForm.rank" :min="0" :max="9999" style="width: 100%"/>
        </el-form-item>
        <el-form-item label="显示父级" prop="showParent" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.showParent" />
        </el-form-item>
        <el-form-item label="显示菜单" prop="showLink" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.showLink" />
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
