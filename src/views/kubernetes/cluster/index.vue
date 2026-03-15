<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { getClusters, createCluster, deleteCluster, updateCluster, updateClusterToken } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { Plus, Refresh } from "@element-plus/icons-vue";

defineOptions({
  name: "Cluster"
});

// 类型定义
interface Rule {
  id: number
  name: string
  host: string
  token: string
  version: string
  description: string
  createAt: string
  updatedAt: string
}

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T  // 后端返回错误时，无 data 字段，改为可选属性
  pagination: Pagination
  code: number
  msg?: string
  success: boolean
}

// 分页类型
interface Pagination {
  page: number
  size: number
  total: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  keyword: string
}

// 分页参数
const pagination = ref<Pagination>({
  page: 1,
  size: 10, // 每页数量
  total: 0,
  sortBy: 'id', // 可选排序字段
  sortOrder: 'asc', // 排序方式
  keyword: '' // 搜索关键字
})

const dataForm = reactive<Omit<Rule, 'id' | 'createAt' | 'updatedAt'>>({
  name: undefined,
  host: undefined,
  token: undefined,
  version: undefined,
  description: undefined
})

const textMap = {
  update: '更新集群',
  create: '创建集群'
}

// 监听分页参数和搜索关键字
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => ({
    page: pagination.value.page,
    size: pagination.value.size,
    keyword: pagination.value.keyword
  }),
  (newVal, oldVal) => {
    // 关键词变化时处理防抖和页码重置
    if (newVal.keyword !== oldVal.keyword) {
      pagination.value.page = 1  // 重置页码
      clearTimeout(searchTimeout)
      // 防止频繁请求后端，延时 1 秒执行
      searchTimeout = setTimeout(() => {
        tableData()
      }, 1000)
    }
    // 页码或每页数量变化时立即请求
    else if (newVal.page !== oldVal.page || newVal.size !== oldVal.size) {
      tableData()
    }
  },
  { deep: true }
)

// 响应式数据
const data = ref<Rule[]>([])

// 对话框相关
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>() // 表单校验
const formLabelWidth = '100px'
const currentEditId = ref<number>() // 当前编辑或删除行的 ID
const tokenDialogVisible = ref(false)
const tokenFormRef = ref<FormInstance>()
const tokenForm = reactive({
  token: ''
})

// 获取表单数据
const tableData = async () => {
  try {
    const response = await getClusters({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword,
    }) as ApiResponse<Rule[]>
    if (!response.success) {
      showApiError(response.msg || response)
      data.value = []
      pagination.value.total = 0
      return
    }
    data.value = response.data ?? []
    pagination.value.total = response.pagination?.total ?? 0
  } catch (error) {
    showApiError(error)
  }
}

// 生命周期钩子
onMounted(() => {
  tableData()
})

// 处理每页条数变化
const handleSizeChange = (val: number) => {
  pagination.value.size = val
}

// 处理当前页变化
const handleCurrentChange = (val: number) => {
  pagination.value.page = val;
}

// 校验规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入集群名称.', trigger: 'blur' }
  ],
  host: [
    { required: true, message: '请输入集群地址.', trigger: 'blur' }
  ],
  token: [
    { required: true, message: '请输入集群凭证.', trigger: 'blur' }
  ],
  version: [
    { required: true, message: '请输入集群版本.', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入集群描述.', trigger: 'blur' }
  ],
})

const tokenRules = reactive<FormRules>({
  token: [
    { required: true, message: '请输入集群凭证.', trigger: 'blur' }
  ]
})


// 创建点击事件
const addClick = () => {
  dialogStatus.value = 'create'
  resetForm() // 重置表单
  dialogFormVisible.value = true
}

// 编辑点击事件
const editClick = (row: Rule) => {
  currentEditId.value = row.id
  Object.assign(dataForm, row)
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
}

const updateTokenClick = (row: Rule) => {
  currentEditId.value = row.id
  tokenForm.token = ''
  tokenDialogVisible.value = true
  nextTick(() => {
    tokenFormRef.value?.clearValidate()
  })
}

// 重置表单
const resetForm = () => {
  Object.assign(dataForm, {
    name: undefined,
    host: undefined,
    token: undefined,
    version: undefined,
    description: undefined
  })
  nextTick(() => {
    dataFormRef.value?.clearValidate()
  })
}

// 对话框关闭回调
const handleDialogClosed = () => {
  dataFormRef.value?.clearValidate()
}

const handleTokenDialogClosed = () => {
  tokenFormRef.value?.clearValidate()
}

// 表单提交操作
const handleFormSubmit = async (
  formEl: FormInstance | undefined,
  operation: 'create' | 'update',
  rowId?: number
) => {
  // 1. 表单引用和ID验证
  if (!formEl) {
    console.error('表单引用未获取到');
    return;
  }

  if (operation === 'update' && rowId === undefined) {
    console.error('更新操作缺少 rowId');
    return;
  }

  try {
    // 2. 表单验证
    await formEl.validate();

    // 3. 根据操作类型执行API调用
    const response = operation === 'create'
      ? await createCluster(dataForm) as ApiResponse<Rule>
      : await updateCluster(rowId, dataForm) as ApiResponse<Rule> // 非空断言因为前面已经验证

    // 4. 处理API响应
    if (!response.success) {
      showApiError(`数据${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`);
      return;
    }

    // 5. 更新UI状态
    dialogFormVisible.value = false;

    if (operation === 'create') {
      data.value.push(response.data);
    } else {
      const index = data.value.findIndex(item => item.id === rowId);
      if (index !== -1) {
        data.value.splice(index, 1, response.data);
      }
    }

    // 6. 成功反馈
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, {
      type: "success"
    });

  } catch (error) {
    showApiError(error);
  }
};

// 创建事件
const createForm = (formEl: FormInstance | undefined) => {
  return handleFormSubmit(formEl, 'create');
};

// 更新事件
const updateForm = (formEl: FormInstance | undefined, rowId?: number) => {
  return handleFormSubmit(formEl, 'update', rowId);
};

const updateTokenForm = async (formEl: FormInstance | undefined) => {
  if (!formEl || currentEditId.value === undefined) return
  try {
    await formEl.validate()
    const response = await updateClusterToken(currentEditId.value, { token: tokenForm.token }) as ApiResponse<Rule>
    if (!response.success) {
      showApiError(`更新凭证失败. 错误信息: ${response.msg}`)
      return
    }
    tokenDialogVisible.value = false
    message('凭证更新成功!', { type: "success", duration: 5000 })
  } catch (error) {
    showApiError(error)
  }
}

// 删除操作
const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要执行删除操作吗？',
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    // 执行删除 API 调用
    const response = await deleteCluster(rowId) as ApiResponse<void>

    //  处理 API 响应
    if (!response.success) {
      showApiError(`删除失败. 错误信息: ${response.msg}`)
      return
    }
    // 删除成功后强制回源刷新，避免前端本地状态与后端不一致
    await tableData()
    message('数据删除成功!', { type: "success", duration: 5000})
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error)
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000})
    }
  }
}

const refreshClick = () => {
  tableData()
}

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
      <el-table-column prop="name" label="集群名称"></el-table-column>
      <el-table-column prop="host" label="集群地址"></el-table-column>
      <el-table-column prop="version" label="集群版本"></el-table-column>
      <el-table-column prop="description" label="集群描述"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间"/>
      <el-table-column fixed="right" label="操作" width="180">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="editClick(scope.row)">
            编辑
          </el-button>
          <el-button link type="primary" size="small" @click="updateTokenClick(scope.row)">
            更新凭证
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
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
      style="float: right;"
    />

    <!-- 表单操作 -->
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="集群名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
        <el-form-item label="集群地址" prop="host" :label-width="formLabelWidth">
          <el-input v-model="dataForm.host"/>
        </el-form-item>
        <el-form-item v-if="dialogStatus==='create'" label="集群凭证" prop="token" :label-width="formLabelWidth">
          <el-input type="textarea" v-model="dataForm.token"/>
        </el-form-item>
        <el-form-item label="集群版本" prop="version" :label-width="formLabelWidth">
          <el-input v-model="dataForm.version"/>
        </el-form-item>
        <el-form-item label="集群描述" prop="description" :label-width="formLabelWidth">
          <el-input v-model="dataForm.description"/>
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

    <el-dialog title="更新凭证" v-model="tokenDialogVisible" width="50%" @closed="handleTokenDialogClosed">
      <el-form ref="tokenFormRef" :model="tokenForm" :rules="tokenRules">
        <el-form-item label="集群凭证" prop="token" :label-width="formLabelWidth">
          <el-input type="textarea" v-model="tokenForm.token" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="tokenDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateTokenForm(tokenFormRef)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">

</style>
