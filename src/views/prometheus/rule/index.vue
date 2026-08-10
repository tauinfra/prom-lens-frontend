<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from "vue";
import {
  getRules,
  createRule,
  deleteRule,
  updateRule,
  getRecords,
  createRecord,
  deleteRecord,
  updateRecord
} from "@/api/prometheus";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessageBox } from "element-plus";
import {
  usePaginatedSearch,
  type Pagination
} from "@/utils/hooks/usePaginatedSearch";
import { formatDate } from "@/utils/date";
import { Plus, Refresh, Delete } from "@element-plus/icons-vue";

import { usePromGroupContext } from "../group/hooks";

defineOptions({
  name: "PromRule"
});

// 类型定义
interface Rule {
  id: number;
  name: string;
  summary: string;
  description: string;
  expr: string;
  labels: { [key: string]: string | number | boolean }; // 允许不同类型的值
  extraAnnotations?: { [key: string]: string | number | boolean };
  for: string;
  status: boolean;
  createAt: string;
  updatedAt: string;
}

const getSeverityType = (severity?: string) => {
  const value = (severity || "").toLowerCase();
  if (value === "info") return "info";
  if (value === "warning" || value === "warn") return "warning";
  if (value === "critical") return "danger";
  return "info";
};

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T; // 后端返回错误时，无 data 字段，改为可选属性
  pagination: Pagination;
  code: number;
  msg?: string;
  success: boolean;
}

const { getParameter, isRecording } = usePromGroupContext({ restoreTag: true });

const ruleNameLabel = computed(() =>
  isRecording.value ? "聚合规则名称" : "告警名称"
);

const ruleExprLabel = computed(() =>
  isRecording.value ? "聚合表达式" : "告警规则"
);

const ruleLabelsLabel = computed(() =>
  isRecording.value ? "标签" : "告警标签"
);

interface KeyValueRow {
  key: string;
  value: string;
}

const KV_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const createEmptyKvRow = (): KeyValueRow => ({ key: "", value: "" });

const recordToRows = (
  record: Record<string, string | number | boolean> | undefined
): KeyValueRow[] => {
  const entries = Object.entries(record || {});
  if (!entries.length) {
    return [createEmptyKvRow()];
  }
  return entries.map(([key, value]) => ({
    key,
    value: String(value ?? "")
  }));
};

const buildRecordFromRows = (
  rows: KeyValueRow[],
  options: {
    fieldName: string;
    required?: boolean;
    allowEmpty?: boolean;
  }
): Record<string, string> => {
  const { fieldName, required = false, allowEmpty = true } = options;
  const normalized = rows
    .map(row => ({ key: row.key.trim(), value: row.value.trim() }))
    .filter(row => row.key || row.value);

  for (const row of normalized) {
    if (!row.key) {
      throw new Error(`${fieldName} Key 不能为空.`);
    }
    if (!KV_KEY_PATTERN.test(row.key)) {
      throw new Error(
        `${fieldName} Key「${row.key}」格式不正确，仅支持字母、数字、下划线，且不能以数字开头。`
      );
    }
  }

  const keys = normalized.map(row => row.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${fieldName} Key 不能重复.`);
  }

  if (!normalized.length) {
    if (required) {
      throw new Error(`请至少添加一个${fieldName}.`);
    }
    if (allowEmpty) {
      return {};
    }
  }

  return Object.fromEntries(normalized.map(row => [row.key, row.value]));
};

const defaultLabels = (): Rule["labels"] =>
  isRecording.value ? {} : { severity: "warning" };

const labelRows = ref<KeyValueRow[]>(recordToRows(defaultLabels()));

const setLabelRowsFromLabels = (
  labels: Record<string, string | number | boolean> | undefined
) => {
  labelRows.value = recordToRows(labels);
};

const buildLabelsFromRows = (): Rule["labels"] => {
  return buildRecordFromRows(labelRows.value, {
    fieldName: ruleLabelsLabel.value,
    required: !isRecording.value,
    allowEmpty: isRecording.value
  });
};

const syncLabelsFromRows = () => {
  dataForm.labels = buildLabelsFromRows();
};

const addLabelRow = () => {
  labelRows.value.push(createEmptyKvRow());
};

const removeLabelRow = (index: number) => {
  if (labelRows.value.length <= 1) {
    labelRows.value[0] = createEmptyKvRow();
    return;
  }
  labelRows.value.splice(index, 1);
};

const annotationRows = ref<KeyValueRow[]>(recordToRows({}));

const setAnnotationRowsFromRecord = (
  record: Record<string, string | number | boolean> | undefined
) => {
  annotationRows.value = recordToRows(record);
};

const buildAnnotationsFromRows = (): NonNullable<Rule["extraAnnotations"]> => {
  return buildRecordFromRows(annotationRows.value, {
    fieldName: "告警注释",
    allowEmpty: true
  });
};

const syncAnnotationsFromRows = () => {
  dataForm.extraAnnotations = buildAnnotationsFromRows();
};

const addAnnotationRow = () => {
  annotationRows.value.push(createEmptyKvRow());
};

const removeAnnotationRow = (index: number) => {
  if (annotationRows.value.length <= 1) {
    annotationRows.value[0] = createEmptyKvRow();
    return;
  }
  annotationRows.value.splice(index, 1);
};

// 响应式数据
const data = ref<Rule[]>([]);

// 对话框相关
const dialogStatus = ref<"create" | "update">("create");
const dialogFormVisible = ref(false);
const dataFormRef = ref<FormInstance>(); // 表单校验
const formLabelWidth = "100px";
const currentEditId = ref<number>(); // 当前编辑或删除行的 ID

// 获取表单数据
const fetchRules = async (p: Pagination) => {
  try {
    const params = {
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword
    };
    const response = isRecording.value
      ? ((await getRecords(getParameter.id, params)) as ApiResponse<Rule[]>)
      : ((await getRules(getParameter.id, params)) as ApiResponse<Rule[]>);
    data.value = response.data ?? [];
    pagination.value.total = response.pagination?.total ?? 0;
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败");
  }
};

// 使用组合函数管理分页和搜索
const { pagination, refresh } = usePaginatedSearch(fetchRules, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: "id",
  initialSortOrder: "asc"
});

// 生命周期钩子
onMounted(() => {
  refresh();
});

const textMap = computed(() => ({
  update: isRecording.value ? "更新聚合规则" : "更新告警规则",
  create: isRecording.value ? "创建聚合规则" : "创建告警规则"
}));

const formRules = computed<FormRules>(() => {
  const baseRules: FormRules = {
    name: [
      {
        required: true,
        message: `请输入${ruleNameLabel.value}.`,
        trigger: "blur"
      }
    ],
    expr: [
      {
        required: true,
        message: `请输入${ruleExprLabel.value}.`,
        trigger: "blur"
      }
    ],
    labels: [
      {
        validator: (_rule, _value, callback) => {
          try {
            syncLabelsFromRows();
            callback();
          } catch (error) {
            callback(
              error instanceof Error ? error : new Error("告警标签校验失败")
            );
          }
        },
        trigger: "change"
      }
    ]
  };

  if (!isRecording.value) {
    baseRules.summary = [
      { required: true, message: "请输入告警标题.", trigger: "blur" }
    ];
    baseRules.description = [
      { required: true, message: "请输入告警描述.", trigger: "blur" }
    ];
    baseRules.for = [
      { required: true, message: "请输入告警时间.", trigger: "blur" },
      {
        pattern: /^\d+[smh]$/i,
        message: "输入格式错误，格式应为 number + s/m/h；例如: 30s、5m、1h",
        trigger: "blur"
      }
    ];
    baseRules.extraAnnotations = [
      {
        validator: (_rule, _value, callback) => {
          try {
            syncAnnotationsFromRows();
            callback();
          } catch (error) {
            callback(
              error instanceof Error ? error : new Error("告警注释校验失败")
            );
          }
        },
        trigger: "change"
      }
    ];
  }

  return baseRules;
});

const dataForm = reactive<Omit<Rule, "id" | "createAt" | "updatedAt">>({
  name: undefined,
  summary: undefined,
  description: undefined,
  expr: undefined,
  labels: defaultLabels(),
  extraAnnotations: {},
  for: "1m",
  status: true
});

// 编辑点击事件
const editClick = (row: Rule) => {
  currentEditId.value = row.id;
  Object.assign(dataForm, {
    ...row,
    extraAnnotations: row.extraAnnotations || {}
  });
  setLabelRowsFromLabels(row.labels);
  setAnnotationRowsFromRecord(row.extraAnnotations);
  dialogStatus.value = "update";
  dialogFormVisible.value = true;
};

// 重置表单
const resetForm = () => {
  const labels = defaultLabels();
  Object.assign(dataForm, {
    name: undefined,
    summary: undefined,
    description: undefined,
    expr: undefined,
    labels,
    extraAnnotations: {},
    for: "1m",
    status: true
  });
  setLabelRowsFromLabels(labels);
  setAnnotationRowsFromRecord({});
  nextTick(() => {
    dataFormRef.value?.clearValidate();
  });
};

// 创建点击事件
const addClick = () => {
  dialogStatus.value = "create";
  resetForm(); // 重置表单
  dialogFormVisible.value = true;
};

const refreshClick = () => refresh();

// 对话框关闭回调
const handleDialogClosed = () => {
  dataFormRef.value?.clearValidate();
};

// 表单提交操作
const handleFormSubmit = async (
  formEl: FormInstance | undefined,
  operation: "create" | "update",
  rowId?: number
) => {
  // 1. 表单引用和ID验证
  if (!formEl) {
    console.error("表单引用未获取到");
    return;
  }

  if (operation === "update" && rowId === undefined) {
    console.error("更新操作缺少 rowId");
    return;
  }

  try {
    // 2. 先将输入框中的 JSON 同步到表单，避免未失焦时只保存部分内容
    syncLabelsFromRows();
    if (!isRecording.value) {
      syncAnnotationsFromRows();
    }

    await formEl.validate();

    const response =
      operation === "create"
        ? isRecording.value
          ? ((await createRecord(
              getParameter.id,
              dataForm
            )) as ApiResponse<Rule>)
          : ((await createRule(getParameter.id, dataForm)) as ApiResponse<Rule>)
        : isRecording.value
          ? ((await updateRecord(
              getParameter.id,
              rowId!,
              dataForm
            )) as ApiResponse<Rule>)
          : ((await updateRule(
              getParameter.id,
              rowId!,
              dataForm
            )) as ApiResponse<Rule>);

    // 5. 处理API响应
    if (!response.success) {
      message(
        `数据${operation === "create" ? "添加" : "更新"}失败. 错误信息: ${response.msg}`,
        {
          type: "error"
        }
      );
      return;
    }

    // 6. 刷新并更新 UI 状态
    refresh();
    dialogFormVisible.value = false;

    // 7. 成功反馈
    message(`数据${operation === "create" ? "添加" : "更新"}成功!`, {
      type: "success"
    });
  } catch (error) {
    // 8. 统一错误处理
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "操作失败，请重试";
    message(errorMessage, { type: "error" });
  }
};

// 创建事件
const createForm = (formEl: FormInstance | undefined) => {
  return handleFormSubmit(formEl, "create");
};

// 更新事件
const updateForm = (formEl: FormInstance | undefined, rowId?: number) => {
  return handleFormSubmit(formEl, "update", rowId);
};

// 删除操作
const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      "此操作不可撤销，确定要删除这条记录吗？",
      "提示内容",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    // 执行删除 API 调用
    const response = isRecording.value
      ? ((await deleteRecord(getParameter.id, rowId)) as ApiResponse<void>)
      : ((await deleteRule(getParameter.id, rowId)) as ApiResponse<void>);

    //  处理 API 响应
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: "error" });
      return;
    }
    refresh();
    message("数据删除成功!", { type: "success", duration: 5000 });
  } catch (error) {
    if (error !== "cancel") {
      message(
        `删除操作出错: ${error instanceof Error ? error.message : "未知错误"}`,
        { type: "error" }
      );
    } else {
      message("已取消删除操作!", { type: "info", duration: 5000 });
    }
  }
};
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="float: right; min-width: 350px; margin-bottom: 10px">
        <el-input
          v-model="pagination.keyword"
          size="small"
          placeholder="输入关键字搜索"
        />
      </div>
      <el-button type="primary" plain @click="addClick">
        <el-icon><Plus /></el-icon>
        <span>新增</span>
      </el-button>
      <el-button
        type="info"
        plain
        style="margin-left: 5px"
        @click="refreshClick"
      >
        <el-icon><Refresh /></el-icon>
        <span>刷新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="rule-expand">
            <template v-if="!isRecording">
              <div class="rule-expand__line">
                <span class="rule-expand__label">告警标题:</span>
                <span class="rule-expand__value">{{ row.summary || "-" }}</span>
              </div>
              <div class="rule-expand__line">
                <span class="rule-expand__label">告警描述:</span>
                <span class="rule-expand__value">{{
                  row.description || "-"
                }}</span>
              </div>
            </template>
            <div class="rule-expand__line">
              <span class="rule-expand__label">{{
                isRecording ? "聚合表达式:" : "告警规则:"
              }}</span>
              <span class="rule-expand__value">{{ row.expr || "-" }}</span>
            </div>
            <div v-if="!isRecording" class="rule-expand__line">
              <span class="rule-expand__label">告警注释:</span>
              <span class="rule-expand__value">
                <el-tag
                  v-for="(v, k) in row.extraAnnotations || {}"
                  :key="k"
                  type="info"
                  effect="light"
                  size="small"
                  class="rule-expand__tag"
                >
                  {{ k }}: {{ v }}
                </el-tag>
                <span v-if="!Object.keys(row.extraAnnotations || {}).length"
                  >-</span
                >
              </span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" :label="ruleNameLabel" />
      <el-table-column :label="ruleLabelsLabel" min-width="200">
        <template #default="{ row }">
          <el-tag
            v-for="(v, k) in row.labels || {}"
            :key="k"
            type="info"
            effect="light"
            size="small"
            class="rule-expand__tag"
          >
            {{ k }}: {{ v }}
          </el-tag>
          <span v-if="!Object.keys(row.labels || {}).length">-</span>
        </template>
      </el-table-column>
      <el-table-column
        v-if="!isRecording"
        prop="labels"
        size="small"
        label="告警级别"
        width="170"
      >
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
      <el-table-column
        v-if="!isRecording"
        prop="for"
        label="告警时间"
        width="170"
      />
      <el-table-column
        v-if="!isRecording"
        prop="status"
        label="告警状态"
        width="170"
      >
        <template #default="props">
          <el-switch
            :model-value="props.row.status"
            disabled
            style="

              --el-switch-on-color: #13ce66;
              --el-switch-off-color: #ff4949;
            "
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
          <el-button
            link
            type="primary"
            size="small"
            @click="editClick(scope.row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            @click="handleDelete(scope.row.id)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 表单分页 -->
    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      background
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right"
    />

    <!-- 表单操作 -->
    <el-dialog
      v-model="dialogFormVisible"
      :title="textMap[dialogStatus]"
      width="70%"
      @closed="handleDialogClosed"
    >
      <el-form ref="dataFormRef" :model="dataForm" :rules="formRules">
        <el-form-item
          :label="ruleNameLabel"
          prop="name"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.name" />
        </el-form-item>
        <el-form-item
          v-if="!isRecording"
          label="告警标题"
          prop="summary"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.summary" />
        </el-form-item>
        <el-form-item
          v-if="!isRecording"
          label="告警描述"
          prop="description"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.description" />
        </el-form-item>
        <el-form-item
          :label="ruleExprLabel"
          prop="expr"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.expr" />
        </el-form-item>
        <el-form-item
          :label="ruleLabelsLabel"
          prop="labels"
          :label-width="formLabelWidth"
        >
          <div class="kv-rows">
            <div
              v-for="(row, index) in labelRows"
              :key="index"
              class="kv-rows__item"
            >
              <el-input
                v-model="row.key"
                placeholder="Key，如 severity"
                class="kv-rows__key"
              />
              <el-input
                v-model="row.value"
                placeholder="Value，如 warning"
                class="kv-rows__value"
              />
              <el-button
                link
                type="danger"
                :icon="Delete"
                @click="removeLabelRow(index)"
              >
                删除
              </el-button>
            </div>
            <el-button type="primary" link @click="addLabelRow">
              <el-icon><Plus /></el-icon>
              添加{{ ruleLabelsLabel }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item
          v-if="!isRecording"
          label="告警注释"
          prop="extraAnnotations"
          :label-width="formLabelWidth"
        >
          <div class="kv-rows">
            <div
              v-for="(row, index) in annotationRows"
              :key="index"
              class="kv-rows__item"
            >
              <el-input
                v-model="row.key"
                placeholder="Key，如 runbook_url"
                class="kv-rows__key"
              />
              <el-input
                v-model="row.value"
                placeholder="Value"
                class="kv-rows__value"
              />
              <el-button
                link
                type="danger"
                :icon="Delete"
                @click="removeAnnotationRow(index)"
              >
                删除
              </el-button>
            </div>
            <el-button type="primary" link @click="addAnnotationRow">
              <el-icon><Plus /></el-icon>
              添加告警注释
            </el-button>
          </div>
        </el-form-item>
        <el-form-item
          v-if="!isRecording"
          label="持续时间"
          prop="for"
          :label-width="formLabelWidth"
        >
          <el-input
            v-model="dataForm.for"
            placeholder="持续时间: 30s(秒)、5m(分钟)、1h(小时)"
          />
        </el-form-item>
        <el-form-item
          v-if="!isRecording"
          label="告警状态"
          prop="status"
          :label-width="formLabelWidth"
        >
          <el-switch v-model="dataForm.status" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogFormVisible = false">取 消</el-button>
          <el-button
            type="primary"
            @click="
              dialogStatus === 'create'
                ? createForm(dataFormRef)
                : updateForm(dataFormRef, currentEditId)
            "
          >
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
  gap: 4px;
  align-items: flex-start;
}

.rule-expand__label {
  margin-left: 10px;
  color: #606266;
  white-space: nowrap;
}

.rule-expand__value {
  flex: 1;
  font-family:
    "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", sans-serif;
  word-break: break-all;
}

.rule-expand__tag {
  margin-right: 4px;
  margin-bottom: 4px;
}

.kv-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.kv-rows__item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.kv-rows__key,
.kv-rows__value {
  flex: 1;
}
</style>
