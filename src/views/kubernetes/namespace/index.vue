<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { batchDeleteNamespaces, createNamespace, deleteNamespace, getClusters, getNamespaces, updateNamespace } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { ElMessageBox } from 'element-plus'
import type { DrawerProps, FormInstance, FormRules } from 'element-plus'
import { Check, Close, Delete, Plus, Refresh } from "@element-plus/icons-vue";

defineOptions({
  name: "Namespace"
});

// 类型定义
interface Rule {
  id: number
  name: string
  status: string
  labels?: Record<string, string>
  createAt: string
}

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T  // 后端返回错误时，无 data 字段，改为可选属性
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
  status: undefined,
  deleteProtection: false
})

const textMap = {
  create: '创建命名空间'
}

// 响应式数据
const data = ref<Rule[]>([])
const selectedNamespaceNames = ref<string[]>([])

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
  return data.value.filter((item: Rule) =>
    Object.keys(item).some(key =>
      normalizeSearchValue((item as Record<string, unknown>)[key]).includes(kw)
    )
  )
})
const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  return filteredData.value.slice(start, start + pagination.value.size)
})

watch(() => pagination.value.keyword, () => { pagination.value.page = 1 })
watch(filteredData, (val) => { pagination.value.total = val.length }, { immediate: true })

const clusterID = ref<number>()
const clusterOptions = ref<Rule[]>([])

// 对话框相关
const dialogStatus = ref<'create'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>() // 表单校验
const formLabelWidth = '120px'
// 标签管理
const directionLabels = ref<DrawerProps['direction']>()
const drawerLabels = ref(false)
const namespaceName = ref<string>('')
const labelTags = ref<{ name: string; value: string }[]>([])
const manageLabels = (row: Rule) => {
  drawerLabels.value = true
  namespaceName.value = row.name
  labelTags.value = Object.entries(row.labels || {}).map(([name, value]) => ({
    name,
    value
  }))
}
const addLabelTag = () => {
  labelTags.value.push({ name: '', value: '' })
}
const deleteLabelTag = (index: number) => {
  labelTags.value.splice(index, 1)
}
const labelCancelClick = () => {
  drawerLabels.value = false
}
const labelsUpdateForm = async () => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  const labels: Record<string, string> = {}
  labelTags.value.forEach(tag => {
    if (tag.name.trim()) {
      labels[tag.name] = tag.value
    }
  })
  const response = await updateNamespace(clusterID.value, namespaceName.value, { labels }) as ApiResponse
  if (!response.success) {
    showApiError(`命名空间 ${namespaceName.value} 标签更新失败. 错误信息: ${response.msg}`)
    return
  }
  drawerLabels.value = false
  message(`命名空间 ${namespaceName.value} 标签更新成功!`, {
    type: "success"
  })
  tableData()
}

const handleDelete = async (row: Rule) => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  try {
    await ElMessageBox.confirm(
      `此操作将永久删除命名空间 ${row.name}，是否继续？`,
      '提示',
      {
        confirmButtonText: '确 认',
        cancelButtonText: '取 消',
        type: 'warning'
      }
    )
  } catch {
    return
  }
  const response = await deleteNamespace(clusterID.value, row.name) as ApiResponse
  if (!response.success) {
    showApiError(`命名空间 ${row.name} 删除失败. 错误信息: ${response.msg}`)
    return
  }
  message(`命名空间 ${row.name} 删除成功!`, {
    type: "success"
  })
  tableData()
}

const handleSelectionChange = (selection: Rule[]) => {
  selectedNamespaceNames.value = selection.map(item => item.name).filter(Boolean)
}

const handleBatchDelete = async () => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  if (selectedNamespaceNames.value.length === 0) {
    message('请先选择要删除的命名空间', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedNamespaceNames.value.length} 个命名空间，此操作不可撤销，确定要执行删除操作吗？`,
      '提示',
      { confirmButtonText: '确 认', cancelButtonText: '取 消', type: 'warning' }
    )
    const response = await batchDeleteNamespaces(clusterID.value, { names: selectedNamespaceNames.value }) as ApiResponse<void>
    if (!response.success) {
      showApiError(`命名空间批量删除失败. 错误信息: ${response.msg}`)
      return
    }
    selectedNamespaceNames.value = []
    await tableData()
    message('批量删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error)
    } else {
      message('已取消批量删除操作!', { type: "info", duration: 5000 })
    }
  }
}

// 集群下拉框数据
const clusterData = async () => {
  try {
    const response = await getClusters({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword,}) as ApiResponse<Rule[]>
    clusterOptions.value = response.data
  } catch (error) {
    showApiError(error)
  }
}
// 获取表单数据
const tableData = async () => {
  try {
    const response = await getNamespaces(clusterID.value) as ApiResponse<Rule[]>
    data.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

const selectChange = () => {
  pagination.value.page = 1
  tableData()
}

// 刷新
const refreshClick = () => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  tableData()
}

// 生命周期钩子
onMounted(() => {
  clusterData()
})

// 处理每页条数变化
const handleSizeChange = (val: number) => {
  pagination.value.page = val
}

// 处理当前页变化
const handleCurrentChange = (val: number) => {
  pagination.value.page = val;
}

// 校验规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入命名空间.', trigger: 'blur' }
  ]
})


// 创建点击事件
const addClick = () => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  dialogStatus.value = 'create'
  resetForm() // 重置表单
  dialogFormVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(dataForm, {
    name: undefined,
    status: undefined,
    deleteProtection: false
  })
  nextTick(() => {
    dataFormRef.value?.clearValidate()
  })
}

// 对话框关闭回调
const handleDialogClosed = () => {
  dataFormRef.value?.clearValidate()
}

// 表单提交操作
const handleFormSubmit = async (formEl: FormInstance | undefined) => {
  // 1. 表单引用验证
  if (!formEl) {
    console.error('表单引用未获取到');
    return;
  }

  try {
    // 2. 表单验证
    await formEl.validate();

    // 3. 根据操作类型执行API调用
    const response = await createNamespace(clusterID.value, dataForm) as ApiResponse<Rule>

    // 4. 处理API响应
    if (!response.success) {
      showApiError(response);
      return;
    }

    // 5. 更新UI状态
    dialogFormVisible.value = false;

    data.value.push(response.data);

    // 6. 成功反馈
    message(`数据添加成功!`, {
      type: "success"
    });

  } catch (error) {
    showApiError(error);
  }
};

// 创建事件
const createForm = (formEl: FormInstance | undefined) => {
  return handleFormSubmit(formEl);
};

</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-select v-model="clusterID" placeholder="请选择" @change="selectChange" style="width: 240px">
        <el-option
          v-for="item in clusterOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <el-button type="primary" plain style="margin-left: 5px;" @click="addClick">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
      <el-button
        v-show="selectedNamespaceNames.length > 0"
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
      <el-table-column prop="name" label="命名空间名称"></el-table-column>
      <el-table-column prop="status" label="状态"></el-table-column>
      <el-table-column label="删除保护">
        <template #default="scope">
          <el-tag
            v-if="['default', 'kube-system', 'kube-public'].includes(scope.row.name)"
            type="danger"
          >
            系统
          </el-tag>
          <el-tag
            v-else
            :type="scope.row.labels?.['platform.io/protected'] === 'true' ? 'success' : 'info'"
          >
            {{ scope.row.labels?.['platform.io/protected'] === 'true' ? '开启' : '关闭' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="160">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="manageLabels(scope.row)">
            标签管理
          </el-button>
          <el-button link type="primary" size="small" @click="handleDelete(scope.row)">
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
        <el-form-item label="命名空间名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogFormVisible = false">取 消</el-button>
          <el-button type="primary" @click="createForm(dataFormRef)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 标签管理 -->
    <el-drawer title="标签管理" v-model="drawerLabels" :direction="directionLabels" resizable size="55%">
      <el-form :inline="true" :model="data" class="demo-form-inline" :label-position="'top'">
        <div v-for="(label, index) in labelTags" :key="index" class="tag-item">
          <div class="tag-inputs">
            <el-form-item>
              <el-input
                v-model="label.name"
                placeholder="标签键"
                style="width: 400px"
              ></el-input>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="label.value"
                placeholder="标签值"
                style="width: 400px"
              ></el-input>
            </el-form-item>
            <el-button @click="deleteLabelTag(index)" :icon="Delete" circle />
          </div>
        </div>
        <el-button @click="addLabelTag" type="primary" plain>
          <el-icon><Plus /></el-icon>
          <span>添加标签</span>
        </el-button>
      </el-form>
      <template #footer>
        <el-divider />
        <div class="dialog-footer">
          <el-button @click="labelCancelClick">取 消</el-button>
          <el-button type="primary" @click="labelsUpdateForm">确 认</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.el-form-item {
  margin-right: 10px;
  margin-bottom: 10px;
}

.tag-inputs {
  display: flex;
}

</style>
