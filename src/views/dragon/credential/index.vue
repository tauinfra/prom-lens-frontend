<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { getCredentials, createCredential, deleteCredential, updateCredential } from '@/api/dragon'
import { message } from "@/utils/message"
import { ElMessageBox } from 'element-plus'
import { Plus, Refresh } from "@element-plus/icons-vue"
import type { FormInstance, FormRules } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'

defineOptions({ name: "DRGCredential" })

// -------------------------------
// 类型定义
// -------------------------------
interface Credential {
  id: number
  name: string
  type: string
  baseURL: string
  secretType: string
  username: string
  encryptedSecret: string
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
const data = ref<Credential[]>([])

// -------------------------------
// 表单 & 对话框状态
// -------------------------------
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()

// 环境管理弹窗
const envDialogVisible = ref(false)
const CredentialId = ref<number>()
const envTableRef = ref<any>()

// 表单数据
const dataForm = reactive<Omit<Credential, 'id' | 'createAt' | 'updatedAt'>>({
  name: undefined,
  type: undefined,
  baseURL: undefined,
  secretType: undefined,
  username: undefined,
  encryptedSecret: undefined,
})

// 表单校验规则
const Credentials = reactive<FormRules>({
  name: [{ required: true, message: '请输入凭证名称.', trigger: 'blur' }],
  type: [{ required: true, message: '请选择凭证类型.', trigger: 'change' }],
  baseURL: [{ required: true, message: '请输入服务地址.', trigger: 'blur' }],
  encryptedSecret: [{ required: true, message: '请输入凭证密钥.', trigger: 'blur' }],
  username: [{
    validator: (_rule, value, callback) => {
      if (dataForm.type === 'harbor' && !value) {
        callback(new Error('请输入凭证账号.'))
        return
      }
      callback()
    },
    trigger: 'blur'
  }]
})

// dialog 标题映射
const textMap = { update: '更新凭证', create: '创建凭证' }

// -------------------------------
// API 调用
// -------------------------------
async function fetchCredentials(p: Pagination) {
  try {
    const response = await getCredentials({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Credential[]>

    data.value = response.data ?? []
    pagination.value.total = response.pagination?.total ?? 0
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

// -------------------------------
// 生命周期
// -------------------------------
onMounted(() => refresh())

// 关闭环境弹窗时清空表格
watch(envDialogVisible, (val) => {
  if (!val) envTableRef.value?.clearTableData()
})

// -------------------------------
// 表单操作函数
// -------------------------------
const resetForm = () => {
  Object.assign(dataForm, {
    name: undefined,
    type: undefined,
    baseURL: undefined,
    secretType: undefined,
    username: undefined,
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

    // 提交前统一赋值
    if (dataForm.type === 'gitlab') dataForm.secretType = 'token'
    if (dataForm.type === 'harbor') dataForm.secretType = 'password'

    const response = operation === 'create'
      ? await createCredential(dataForm) as ApiResponse<Credential>
      : await updateCredential(rowId!, dataForm) as ApiResponse<Credential>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败: ${response.msg}`, { type: 'error' })
      return
    }

    dialogFormVisible.value = false
    await refresh()
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

    const response = await deleteCredential(rowId) as ApiResponse<void>
    if (!response.success) {
      message(`删除失败: ${response.msg}`, { type: 'error' })
      return
    }

    const index = data.value.findIndex(item => item.id === rowId)
    if (index !== -1) data.value.splice(index, 1)
    pagination.value.total -= 1

    if (data.value.length === 0 && pagination.value.page > 1) {
      pagination.value.page -= 1
      refresh()
    }

    message('数据删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') message(`删除操作出错: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' })
    else message('已取消删除操作!', { type: 'info', duration: 5000 })
  }
}

const addClick = () => { dialogStatus.value = 'create'; resetForm(); dialogFormVisible.value = true }
const editClick = (row: Credential) => { currentEditId.value = row.id; Object.assign(dataForm, row); dialogStatus.value = 'update'; dialogFormVisible.value = true }
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
      <el-table-column prop="name" label="凭证名称"></el-table-column>
      <el-table-column prop="type" label="凭证类型"></el-table-column>
      <el-table-column prop="creator" label="创建人"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间"/>
      <el-table-column fixed="right" label="操作" width="120">
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
      <el-form ref="dataFormRef" :model="dataForm" :rules="Credentials">
        <el-form-item label="凭证名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name" placeholder="请输入凭证名称"/>
        </el-form-item>
        <el-form-item label="凭证类型" prop="type" :label-width="formLabelWidth">
          <el-select v-model="dataForm.type" placeholder="请选择凭证类型" :disabled="dialogStatus === 'update'">
            <el-option label="GitLab" value="gitlab"/>
            <el-option label="Harbor" value="harbor"/>
          </el-select>
        </el-form-item>
        <el-form-item label="服务地址" prop="baseURL" :label-width="formLabelWidth">
          <el-input v-model="dataForm.baseURL" placeholder="请输入服务地址"/>
        </el-form-item>
        <el-form-item label="凭证账号" prop="username" :label-width="formLabelWidth" v-if="dataForm.type === 'harbor'">
          <el-input v-model="dataForm.username" placeholder="请输入凭证账号"/>
        </el-form-item>
        <el-form-item label="凭证密钥" prop="encryptedSecret" :label-width="formLabelWidth">
          <el-input type="password" v-model="dataForm.encryptedSecret" placeholder="请输入凭证密钥"/>
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
