<script setup lang="ts">
import {ref, reactive, onMounted, nextTick, defineProps, watch, Ref } from 'vue'
import { getEnvironments, createEnvironment, deleteEnvironment, updateEnvironment, getCredentials } from '@/api/dragon'
import { message } from "@/utils/message"
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { Plus } from "@element-plus/icons-vue"
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'

// Props 接收项目 ID
const props = defineProps<{ projectId: number }>()

// 类型定义
interface Environment {
  id: number
  name: string
  harborID: number
  harbor: Credential
  description: string
  createAt: string
  updatedAt: string
}

interface Credential {
  id: number
  name: string
  baseURL: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination: Pagination
  code: number
  msg?: string
  success: boolean
}

// CRUD + 分页
async function fetchEnvironments(p: Pagination) {
  try {
    const res = await getEnvironments(props.projectId, {
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Environment[]>

    data.value = res.data ?? []
    pagination.value.total = res.pagination.total
  } catch (err) {
    message(err instanceof Error ? err.message : '获取数据失败')
  }
}

// 使用组合函数管理分页和搜索
const { pagination, refresh } = usePaginatedSearch(fetchEnvironments, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

const data = ref<Environment[]>([])
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

// 下拉框
const credentialOptions = ref<Credential[]>([])

/**
 * 获取应用列表
 */
const fetchCredentials = async () => {
  try {
    const response = await getCredentials({...{page: 1, size: 100}, ...{type: 'harbor'}}) as ApiResponse<[]>
    credentialOptions.value = response.data || []
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

const dataForm = reactive<Omit<Environment, 'id' | 'createAt' | 'updatedAt' | 'harbor' >>({
  name: undefined,
  harborID: undefined,
  description: undefined
})

const textMap = { create: '创建环境', update: '更新环境' }

// 生命周期
onMounted(() => {
  refresh()
  fetchCredentials()
})

// 提供清空表格方法给父组件
const clearTableData = () => {
  data.value = []
  pagination.value.page = 1
  pagination.value.total = 0
}

// 暴露给父组件
defineExpose({clearTableData, refresh})

// 表单校验
const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入环境名称', trigger: 'blur' }],
  harborID: [{ required: true, message: '请选择镜像仓库', trigger: 'blur' }],
  description: [{ required: true, message: '请输入环境描述', trigger: 'blur' }]
})

// CRUD 方法
const addClick = () => {
  dialogStatus.value = 'create'
  Object.assign(dataForm, {
    name: undefined,
    harborID: undefined,
    harbor: undefined,
    description: undefined
  })
  nextTick(() => dataFormRef.value?.clearValidate())
  dialogFormVisible.value = true
}

const editClick = (row: Environment) => {
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
  currentEditId.value = row.id
  Object.assign(dataForm, row)
}

const handleFormSubmit = async (formEl: FormInstance | undefined, operation: 'create' | 'update', rowId?: number) => {
  if (!formEl) return
  if (operation === 'update' && rowId === undefined) return

  try {
    await formEl.validate()
    const res = operation === 'create'
      ? await createEnvironment(props.projectId, dataForm) as ApiResponse<Environment>
      : await updateEnvironment(props.projectId, rowId!, dataForm) as ApiResponse<Environment>

    if (!res.success) return message(`操作失败: ${res.msg}`, { type: 'error' })
    dialogFormVisible.value = false
    await refresh()
    message('操作成功', { type: 'success' })
  } catch (err) {
    message(err instanceof Error ? err.message : '操作失败', { type: 'error' })
  }
}

const createForm = (formEl: FormInstance | undefined) => handleFormSubmit(formEl, 'create')
const updateForm = (formEl: FormInstance | undefined, rowId?: number) => handleFormSubmit(formEl, 'update', rowId)

const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    const res = await deleteEnvironment(props.projectId, rowId) as ApiResponse<void>
    if (!res.success) return message(`删除失败: ${res.msg}`, { type: 'error' })

    const idx = data.value.findIndex(item => item.id === rowId)
    if (idx !== -1) data.value.splice(idx, 1)
    pagination.value.total -= 1
    if (data.value.length === 0 && pagination.value.page > 1) {
      pagination.value.page -= 1
      refresh()
    }
    message('删除成功', { type: 'success' })
  } catch (err) {
    if (err !== 'cancel') message(err instanceof Error ? err.message : '未知错误', { type: 'error' })
  }
}

</script>

<template>
  <div>
    <div class="filter-container">
      <el-input v-model="pagination.keyword" placeholder="输入关键字搜索" style="width: 300px; float:right; margin-bottom: 10px"/>
      <el-button type="primary" plain @click="addClick">
        <el-icon><Plus/></el-icon>新增
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="projectName" label="项目名称"/>
      <el-table-column prop="name" label="环境名称"/>
      <el-table-column prop="harborBaseURL" label="镜像仓库"></el-table-column>
      <el-table-column prop="description" label="环境描述"/>
      <el-table-column fixed="right" label="操作" width="110">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="editClick(scope.row)">编辑</el-button>
          <el-button link type="primary" size="small" @click="handleDelete(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10,20,50,100]"
      layout="total, sizes, prev, pager, next"
      :total="pagination.total"
      style="float:right;"
    />

    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="50%" @closed="()=>dataFormRef.clearValidate()">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="环境名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
        <el-form-item
          label="镜像仓库"
          prop="harborID"
          :label-width="formLabelWidth"
        >
          <el-select
            v-model="dataForm.harborID"
            placeholder="请选择镜像仓库"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="item in credentialOptions"
              :key="item.id"
              :label="item.baseURL"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="环境描述" prop="description" :label-width="formLabelWidth">
          <el-input v-model="dataForm.description"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogFormVisible=false">取消</el-button>
        <el-button type="primary" @click="dialogStatus==='create'?createForm(dataFormRef):updateForm(dataFormRef,currentEditId)">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>
