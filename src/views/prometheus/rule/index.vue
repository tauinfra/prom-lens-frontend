<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import {getRules, createRule, deleteRule, updateRule} from '@/api/prometheus'
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import { formatDate } from '@/utils/date'
import { Plus, Refresh } from "@element-plus/icons-vue"

import { useRules } from "../group/hooks";

defineOptions({
  name: "PromRule"
});

// 类型定义
interface Rule {
  id: number
  name: string
  summary: string
  description: string
  expr: string
  labels: { [key: string]: string | number | boolean; } // 允许不同类型的值
  for: string
  status: boolean
  createAt: string
  updatedAt: string
}

const getSeverityType = (severity?: string) => {
  const value = (severity || '').toLowerCase()
  if (value === 'info') return 'info'
  if (value === 'warning' || value === 'warn') return 'warning'
  if (value === 'critical') return 'danger'
  return 'info'
}

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T  // 后端返回错误时，无 data 字段，改为可选属性
  pagination: Pagination
  code: number
  msg?: string
  success: boolean
}

const { getParameter } = useRules();

// 响应式数据
const data = ref<Rule[]>([])

// 对话框相关
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dataFormRef = ref<FormInstance>() // 表单校验
const formLabelWidth = '100px'
const currentEditId = ref<number>() // 当前编辑或删除行的 ID

// 获取表单数据
const fetchRules = async (p: Pagination) => {
  try {
    const response = await getRules(getParameter.id,{
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Rule[]>
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
const { pagination, refresh } = usePaginatedSearch(fetchRules, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

// 生命周期钩子
onMounted(() => {
  refresh()
})

const textMap = {
  update: 'Update Alerting Rules',
  create: 'Create Alerting Rules'
}

// 校验规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入告警名称.', trigger: 'blur' }
  ],
  summary: [
    { required: true, message: '请输入告警标题.', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入告警描述.', trigger: 'blur' }
  ],
  expr: [
    { required: true, message: '请输入告警规则.', trigger: 'blur' }
  ],
  labels: [
    { required: true, message: '请输入告警标签.', trigger: 'blur' }
  ],
  for: [
    { required: true, message: '请输入告警时间.', trigger: 'blur' },
    {
      pattern: /^\d+[smh]$/i,
      message: '输入格式错误，格式应为 number + s/m/h；例如: 30s、5m、1h',
      trigger: 'blur'
    }
  ],
})

const dataForm = reactive<Omit<Rule, 'id' | 'createAt' | 'updatedAt'>>({
  name: undefined,
  summary: undefined,
  description: undefined,
  expr: undefined,
  labels: {"severity": "warning"}, // 默认标签，必填
  for: '1m',
  status: true
})

// 用于输入的JSON字符串
const labelsString = ref('')

// 将对象转换为JSON字符串
watch(() => dataForm.labels, (newVal) => {
  try {
    labelsString.value = JSON.stringify(newVal, null)
  } catch {
    labelsString.value = ''
  }
}, { immediate: true })

// 处理输入变化
const handleLabelsChange = (value: string) => {
  try {
    dataForm.labels = JSON.parse(value)
  } catch (error) {
    console.error('Invalid JSON format', error)
  }
}

// 创建点击事件
const addClick = () => {
  dialogStatus.value = 'create'
  resetForm() // 重置表单
  dialogFormVisible.value = true
}

const refreshClick = () => refresh()

// 编辑点击事件
const editClick = (row: Rule) => {
  currentEditId.value = row.id
  Object.assign(dataForm, row)
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(dataForm, {
    id: undefined,
    name: undefined,
    type: 'ALERTING RULES',
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
      ? await createRule(getParameter.id, dataForm) as ApiResponse<Rule>
      : await updateRule(getParameter.id, rowId, dataForm) as ApiResponse<Rule> // 非空断言因为前面已经验证

    // 4. 处理API响应
    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`, {
        type: "error"
      });
      return
    }

    // 5. 刷新并更新 UI 状态
    refresh()
    dialogFormVisible.value = false;

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
    const response = await deleteRule(getParameter.id, rowId) as ApiResponse<void>

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
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="rule-expand">
            <div class="rule-expand__line">
              <span class="rule-expand__label">告警标题:</span>
              <span class="rule-expand__value">{{ row.summary || '-' }}</span>
            </div>
            <div class="rule-expand__line">
              <span class="rule-expand__label">告警描述:</span>
              <span class="rule-expand__value">{{ row.description || '-' }}</span>
            </div>
            <div class="rule-expand__line">
              <span class="rule-expand__label">告警规则:</span>
              <span class="rule-expand__value">{{ row.expr || '-' }}</span>
            </div>
            <div class="rule-expand__line">
              <span class="rule-expand__label">告警标签:</span>
              <span class="rule-expand__value">
                <el-tag
                  v-for="(v, k) in (row.labels || {})"
                  :key="k"
                  type="info"
                  effect="light"
                  size="small"
                  class="rule-expand__tag"
                >
                  {{ k }}: {{ v }}
                </el-tag>
                <span v-if="!Object.keys(row.labels || {}).length">-</span>
              </span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="告警名称"></el-table-column>
      <el-table-column prop="labels" size="small" label="告警级别" width="170">
        <template #default="props">
          <el-tag
            v-if="props.row.labels?.severity"
            :type="getSeverityType(String(props.row.labels.severity))"
          >
            {{ props.row.labels.severity }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="for" label="告警时间" width="170"/>
      <el-table-column prop="status" label="告警状态" width="170">
        <template #default="props">
          <el-switch
            :model-value="props.row.status"
            disabled
            style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
          >
            <template #active-action>
              <span class="custom-active-action">T</span>
            </template>
            <template #inactive-action>
              <span class="custom-inactive-action">F</span>
            </template>
          </el-switch>
        </template>
      </el-table-column>

      <el-table-column prop="updatedAt" label="更新时间">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </el-table-column>
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
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="告警名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
        <el-form-item label="告警标题" prop="summary" :label-width="formLabelWidth">
          <el-input v-model="dataForm.summary"/>
        </el-form-item>
        <el-form-item label="告警描述" prop="description" :label-width="formLabelWidth">
          <el-input v-model="dataForm.description"/>
        </el-form-item>
        <el-form-item label="告警规则" prop="expr" :label-width="formLabelWidth">
          <el-input v-model="dataForm.expr"></el-input>
        </el-form-item>
        <el-form-item label="告警标签" prop="labels" :label-width="formLabelWidth">
          <el-input v-model="labelsString" placeholder="告警标签: { key: value, key: value ...}" @change="handleLabelsChange"></el-input>
        </el-form-item>
        <el-form-item label="持续时间" prop="for" :label-width="formLabelWidth">
          <el-input v-model="dataForm.for" placeholder="持续时间: 30s(秒)、5m(分钟)、1h(小时)"></el-input>
        </el-form-item>
        <el-form-item label="告警状态" prop="status" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.status"></el-switch>
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
.rule-expand {
  display: grid;
  gap: 6px;
}

.rule-expand__line {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.rule-expand__label {
  color: #606266;
  white-space: nowrap;
  margin-left: 10px;
}

.rule-expand__value {
  flex: 1;
  word-break: break-all;
  font-family: "Helvetica Neue", Helvetica, Arial, "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", sans-serif;
}

.rule-expand__tag {
  margin-right: 4px;
  margin-bottom: 4px;
}
</style>
