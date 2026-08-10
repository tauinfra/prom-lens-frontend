<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import {
  getTargets,
  createTarget,
  updateTarget,
  deleteTarget
} from "@/api/prometheus";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessageBox } from "element-plus";
import { usePromTargetGroupContext } from "../target-group/hooks";
import { useKeyValueRows } from "../keyValueRows";
import {
  usePaginatedSearch,
  type Pagination
} from "@/utils/hooks/usePaginatedSearch";
import { formatDate } from "@/utils/date";
import { Plus, Refresh, Delete } from "@element-plus/icons-vue";

defineOptions({ name: "PromTarget" });

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

const isValidIpAddress = (value: string) => IPV4_PATTERN.test(value.trim());

interface Target {
  id: number;
  groupID: number;
  ipAddress: string;
  port: number;
  labels: Record<string, string | number | boolean>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T = unknown> {
  data?: T;
  pagination: Pagination;
  code: number;
  msg?: string;
  success: boolean;
}

const { getParameter } = usePromTargetGroupContext({ restoreTag: true });

const data = ref<Target[]>([]);
const dialogStatus = ref<"create" | "update">("create");
const dialogFormVisible = ref(false);
const dataFormRef = ref<FormInstance>();
const formLabelWidth = "110px";
const currentEditId = ref<number>();

const {
  rows: labelRows,
  setFromRecord: setLabelRowsFromRecord,
  resetRows: resetLabelRows,
  addRow: addLabelRow,
  removeRow: removeLabelRow,
  build: buildLabels
} = useKeyValueRows({
  fieldName: "标签",
  required: true,
  allowEmpty: false
});

const dataForm = reactive({
  ipAddress: "",
  port: 9100,
  labels: {} as Record<string, string>,
  enabled: true
});

async function fetchTargets(p: Pagination) {
  try {
    const response = (await getTargets(getParameter.id, {
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword
    })) as ApiResponse<Target[]>;
    data.value = response.data ?? [];
    pagination.value.total = response.pagination?.total ?? 0;
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败");
  }
}

const { pagination, refresh } = usePaginatedSearch(fetchTargets, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: "id",
  initialSortOrder: "asc"
});

onMounted(() => refresh());

const rules = reactive<FormRules>({
  ipAddress: [
    { required: true, message: "请输入 IP 地址.", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (!value || !String(value).trim()) {
          callback();
          return;
        }
        if (!isValidIpAddress(String(value))) {
          callback(new Error("请输入有效的 IPv4 地址，如 10.0.0.10"));
          return;
        }
        callback();
      },
      trigger: "blur"
    }
  ],
  port: [{ required: true, message: "请输入端口.", trigger: "blur" }],
  labels: [
    {
      validator: (_rule, _value, callback) => {
        try {
          dataForm.labels = buildLabels();
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error("标签校验失败"));
        }
      },
      trigger: "change"
    }
  ]
});

const resetForm = () => {
  Object.assign(dataForm, {
    ipAddress: "",
    port: 9100,
    labels: {},
    enabled: true
  });
  resetLabelRows({});
  nextTick(() => dataFormRef.value?.clearValidate());
};

const addClick = () => {
  dialogStatus.value = "create";
  resetForm();
  dialogFormVisible.value = true;
};

const editClick = (row: Target) => {
  currentEditId.value = row.id;
  Object.assign(dataForm, {
    ipAddress: row.ipAddress,
    port: row.port,
    labels: row.labels ?? {},
    enabled: row.enabled !== false
  });
  setLabelRowsFromRecord(row.labels);
  dialogStatus.value = "update";
  dialogFormVisible.value = true;
};

const handleFormSubmit = async (
  formEl: FormInstance | undefined,
  operation: "create" | "update",
  rowId?: number
) => {
  if (!formEl) return;
  if (operation === "update" && rowId === undefined) return;

  try {
    dataForm.labels = buildLabels();
    await formEl.validate();

    const payload = {
      ipAddress: dataForm.ipAddress.trim(),
      port: Number(dataForm.port),
      labels: dataForm.labels,
      enabled: dataForm.enabled
    };

    const response =
      operation === "create"
        ? ((await createTarget(
            getParameter.id,
            payload
          )) as ApiResponse<Target>)
        : ((await updateTarget(
            getParameter.id,
            rowId!,
            payload
          )) as ApiResponse<Target>);

    if (!response.success) {
      message(
        `数据${operation === "create" ? "添加" : "更新"}失败. 错误信息: ${response.msg}`,
        { type: "error" }
      );
      return;
    }

    dialogFormVisible.value = false;
    refresh();
    message(`数据${operation === "create" ? "添加" : "更新"}成功!`, {
      type: "success"
    });
  } catch (error) {
    message(error instanceof Error ? error.message : "操作失败，请重试", {
      type: "error"
    });
  }
};

const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      "此操作不可撤销，确定要删除这条记录吗？",
      "提示内容",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );
    const response = (await deleteTarget(
      getParameter.id,
      rowId
    )) as ApiResponse<void>;
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: "error" });
      return;
    }
    refresh();
    message("数据删除成功!", { type: "success" });
  } catch (error) {
    if (error !== "cancel") {
      message(
        `删除操作出错: ${error instanceof Error ? error.message : "未知错误"}`,
        { type: "error" }
      );
    }
  }
};
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="float: right; min-width: 350px; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索" />
      </div>
      <el-button type="primary" plain @click="addClick">
        <el-icon><Plus /></el-icon>
        <span>新增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px" @click="refresh()">
        <el-icon><Refresh /></el-icon>
        <span>刷新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="ipAddress" label="IP 地址" min-width="130" />
      <el-table-column prop="port" label="端口" width="90" />
      <el-table-column label="标签" min-width="200">
        <template #default="{ row }">
          <el-tag
            v-for="(v, k) in row.labels || {}"
            :key="k"
            type="info"
            effect="light"
            size="small"
            class="prom-table-tag"
          >
            {{ k }}: {{ v }}
          </el-tag>
          <span v-if="!Object.keys(row.labels || {}).length">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="enabled" label="采集状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled !== false ? 'success' : 'info'">
            {{ row.enabled !== false ? "启用" : "禁用" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="180">
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

    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      background
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right"
    />

    <el-dialog
      v-model="dialogFormVisible"
      :title="dialogStatus === 'create' ? '创建采集目标' : '更新采集目标'"
      width="70%"
      @closed="dataFormRef?.clearValidate()"
    >
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item
          label="IP 地址"
          prop="ipAddress"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.ipAddress" placeholder="如 10.0.0.10" />
        </el-form-item>
        <el-form-item label="端口" prop="port" :label-width="formLabelWidth">
          <el-input-number
            v-model="dataForm.port"
            :min="1"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="标签" prop="labels" :label-width="formLabelWidth">
          <div class="kv-rows">
            <div
              v-for="(row, index) in labelRows"
              :key="index"
              class="kv-rows__item"
            >
              <el-input
                v-model="row.key"
                placeholder="Key，如 node"
                class="kv-rows__key"
              />
              <el-input
                v-model="row.value"
                placeholder="Value，如 node-a"
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
              添加标签
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="采集状态" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogFormVisible = false">取 消</el-button>
        <el-button
          type="primary"
          @click="
            dialogStatus === 'create'
              ? handleFormSubmit(dataFormRef, 'create')
              : handleFormSubmit(dataFormRef, 'update', currentEditId)
          "
        >
          确 认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.prom-table-tag {
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
