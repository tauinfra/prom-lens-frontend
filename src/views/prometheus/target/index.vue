<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { getTargets, createTarget, deleteTarget, updateTarget } from '@/api/prometheus'
import { message } from "@/utils/message"
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'
import { Plus, Refresh } from "@element-plus/icons-vue"
import { useTargets } from "../target-group/hooks"

defineOptions({ name: "PromTarget" })

interface Target {
  id: number
  groupID: number
  ipAddress: string
  port: number
  labels: Record<string, string>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination: Pagination
  code: number
  msg?: string
  success: boolean
}

const { getParameter } = useTargets()

const data = ref<Target[]>([])
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

const textMap = { update: '更新 Target 实例', create: '创建 Target 实例' }

const rules = reactive<FormRules>({
  ipAddress: [{ required: true, message: '请输入实例地址.', trigger: 'blur' }],
  port: [{ required: true, message: '请输入实例端口.', trigger: 'blur' }],
  labels: [{ required: true, message: '请输入实例标签.', trigger: 'blur' }]
})

const dataForm = reactive<Omit<Target, 'id' | 'createdAt' | 'updatedAt'>>({
  groupID: undefined,
  ipAddress: undefined,
  port: undefined,
  labels: {},
  enabled: true
})

const labelsString = ref('')
watch(() => dataForm.labels, (newVal) => {
  try {
    labelsString.value = JSON.stringify(newVal, null)
  } catch {
    labelsString.value = ''
  }
}, { immediate: true })

const handleLabelsChange = (value: string) => {
  try {
    dataForm.labels = JSON.parse(value)
  } catch (error) {
    console.error('Invalid JSON format', error)
  }
}

const fetchTargets = async (p: Pagination) => {
  try {
    const response = await getTargets(getParameter.id, {
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Target[]>
    data.value = response.data ?? []
    pagination.value.total = response.pagination?.total ?? 0;
  } catch (error) {
    if (error instanceof Error) {
      message(error.message)
    } else {
      message('获取数据失败')
    }
  }
}

const { pagination, refresh } = usePaginatedSearch(fetchTargets, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

onMounted(() => {
  refresh()
})

const resetForm = () => {
  Object.assign(dataForm, {
    groupID: Number(getParameter.id),
    ipAddress: undefined,
    port: undefined,
    labels: {},
    enabled: true
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
      ? await createTarget(getParameter.id, dataForm) as ApiResponse<Target>
      : await updateTarget(getParameter.id, rowId!, dataForm) as ApiResponse<Target>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`, {
        type: "error"
      })
      return
    }
    refresh()
    dialogFormVisible.value = false
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: "success" })
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '操作失败，请重试';
    message(errorMessage, { type: "error" });
  }
}

const createForm = (formEl: FormInstance | undefined) => handleFormSubmit(formEl, 'create')
const updateForm = (formEl: FormInstance | undefined, rowId?: number) => handleFormSubmit(formEl, 'update', rowId)

const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要删除这条记录吗？',
      '提示内容',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await deleteTarget(getParameter.id, rowId) as ApiResponse<void>
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: "error" })
      return
    }
    refresh()
    message('数据删除成功!', { type: "success", duration: 5000})
  } catch (error) {
    if (error !== 'cancel') {
      message(`删除操作出错: ${error instanceof Error ? error.message : '未知错误'}`, { type: "error" })
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000})
    }
  }
}

const addClick = () => {
  dialogStatus.value = 'create'
  resetForm()
  dialogFormVisible.value = true
}

const editClick = (row: Target) => {
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
        <el-input v-model="pagination.keyword" size="small" placeholder="输入关键字搜索"/>
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
      <el-table-column prop="ipAddress" label="实例地址"></el-table-column>
      <el-table-column prop="port" label="实例端口"></el-table-column>
      <el-table-column prop="labels" label="实例标签">
        <template #default="{ row }">
          <el-tag
            v-for="(v, k) in (row.labels || {})"
            :key="k"
            type="info"
            effect="light"
            size="small"
            style="margin-right: 6px;"
          >
            {{ k }}: {{ v }}
          </el-tag>
          <span v-if="!Object.keys(row.labels || {}).length">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="enabled" label="实例状态">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'danger'">
            {{ row.enabled ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
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
        <el-form-item label="实例地址" prop="ipAddress" :label-width="formLabelWidth">
          <el-input v-model="dataForm.ipAddress"/>
        </el-form-item>
        <el-form-item label="实例端口" prop="port" :label-width="formLabelWidth">
          <el-input type="number" v-model.number="dataForm.port" :min="1" :max="65535" style="width: 100%"/>
        </el-form-item>
        <el-form-item label="实例标签" prop="labels" :label-width="formLabelWidth">
          <el-input v-model="labelsString" placeholder='标签: {"node":"node-a"}' @change="handleLabelsChange"/>
        </el-form-item>
        <el-form-item label="实例状态" prop="enabled" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.enabled" />
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
