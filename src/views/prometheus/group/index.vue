<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { getGroups, createGroup, updateGroup, deleteGroup } from '@/api/prometheus'
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { useRules } from "./hooks";
import { useTargets } from "../target-group/hooks";
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'

defineOptions({
  name: "PromGroup"
});

const { goToRules } = useRules();
const { goToTargets } = useTargets();

// 类型定义
interface Group {
  id: number
  name: string
  type: 'ALERTING RULES' | 'ALERTING RECORDS'
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

// 获取表单数据
async function fetchGroups(p: Pagination) {
  try {
    const response = await getGroups({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Group[]>
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

// 使用组合函数管理分页和搜索
const { pagination, refresh } = usePaginatedSearch(fetchGroups, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

// 响应式数据
const data = ref<Group[]>([])

// 对话框相关
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>() // 表单校验
const formLabelWidth = '100px'
const currentEditId = ref<number>() // 当前编辑或删除行的 ID

// 生命周期钩子
onMounted(() => {
  refresh()
})

const textMap = {
  update: 'Update Prom Group',
  create: 'Create Prom Group'
}

// 校验规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入规则组名称.', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择规则组类型.', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入规则组描述.', trigger: 'blur' }
  ]
})

const dataForm = reactive<Omit<Group, 'id' | 'createAt' | 'updatedAt'>>({
  name: '',
  type: 'ALERTING RULES',
  description: ''
})

// 创建点击事件
const addClick = () => {
  dialogStatus.value = 'create'
  resetForm() // 重置表单
  dialogFormVisible.value = true
}

// 编辑点击事件
const editClick = (row: Group) => {
  currentEditId.value = row.id
  Object.assign(dataForm, row)
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(dataForm, {
    id: undefined,
    name: '',
    type: 'ALERTING RULES',
    description: ''
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
      ? await createGroup(dataForm) as ApiResponse<Group>
      : await updateGroup(rowId!, dataForm) as ApiResponse<Group> // 非空断言因为前面已经验证

    // 4. 处理API响应
    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`, {
        type: "error"
      });
    }

    // 5. 更新UI状态
    dialogFormVisible.value = false;

    refresh()
    // 6. 成功反馈
    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, {
      type: "success"
    });

  } catch (error) {
    // 7. 统一错误处理
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '操作失败，请重试';
    message(errorMessage, { type: "error" });
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

// 删除操作
const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要删除这条记录吗？',
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    // 执行删除 API 调用
    const response = await deleteGroup(rowId) as ApiResponse<void>

    //  处理 API 响应
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
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-button type="primary" plain @click="addClick">
        新增
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="name" label="规则组名称"/>
      <el-table-column prop="type" label="规则组类型" />
      <el-table-column prop="description" label="规则组描述" />
      <el-table-column prop="updatedAt" label="更新时间">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="200">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="goToRules({ id:  scope.row.id}, 'params')">
            规则
          </el-button>
          <el-button link type="primary" size="small" @click="goToTargets({ id: scope.row.id }, 'params')">
            目标
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

    <!-- 表单操作 -->
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="规则组名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
        <el-form-item label="规则组类型" prop="type" :label-width="formLabelWidth">
          <el-select v-model="dataForm.type">
            <el-option label="ALERTING RULES" value="ALERTING RULES" />
            <el-option label="ALERTING RECORDS" value="ALERTING RECORDS" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则组描述" prop="description" :label-width="formLabelWidth">
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

  </div>
</template>

<style scoped lang="scss">

</style>
