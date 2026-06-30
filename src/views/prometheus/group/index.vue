<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from "vue";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup
} from "@/api/prometheus";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessageBox } from "element-plus";
import { usePromGroupContext } from "./hooks";
import {
  usePaginatedSearch,
  type Pagination
} from "@/utils/hooks/usePaginatedSearch";
import { formatDate } from "@/utils/date";
import { PROM_GROUP_TYPES, type PromGroupType } from "../constants";
import { Plus, Refresh } from "@element-plus/icons-vue";

defineOptions({
  name: "PromGroup"
});

const { groupType, isRecording, goToDetail } = usePromGroupContext();

const detailButtonText = computed(() =>
  isRecording.value ? "聚合规则" : "告警规则"
);

interface Group {
  id: number;
  name: string;
  type: PromGroupType;
  description: string;
  createAt: string;
  updatedAt: string;
}

interface ApiResponse<T = any> {
  data?: T;
  pagination: Pagination;
  code: number;
  msg?: string;
  success: boolean;
}

async function fetchGroups(p: Pagination) {
  try {
    const response = (await getGroups({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
      type: groupType.value
    })) as ApiResponse<Group[]>;
    const list = response.data ?? [];
    data.value = list.filter(item => item.type === groupType.value);
    pagination.value.total = response.pagination?.total ?? data.value.length;
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败");
  }
}

const { pagination, refresh } = usePaginatedSearch(fetchGroups, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: "id",
  initialSortOrder: "asc"
});

const refreshClick = () => refresh();

const data = ref<Group[]>([]);
const dialogStatus = ref<"create" | "update">("create");
const dialogFormVisible = ref(false);
const dataFormRef = ref<FormInstance>();
const formLabelWidth = "100px";
const currentEditId = ref<number>();

onMounted(() => {
  refresh();
});

const textMap = computed(() => ({
  update: isRecording.value ? "更新聚合规则组" : "更新告警规则组",
  create: isRecording.value ? "创建聚合规则组" : "创建告警规则组"
}));

const rules = reactive<FormRules>({
  name: [{ required: true, message: "请输入规则组名称.", trigger: "blur" }],
  description: [
    { required: true, message: "请输入规则组描述.", trigger: "blur" }
  ]
});

const dataForm = reactive<Omit<Group, "id" | "createAt" | "updatedAt">>({
  name: "",
  type: PROM_GROUP_TYPES.ALERTING,
  description: ""
});

const addClick = () => {
  dialogStatus.value = "create";
  resetForm();
  dialogFormVisible.value = true;
};

const editClick = (row: Group) => {
  currentEditId.value = row.id;
  Object.assign(dataForm, row);
  dialogStatus.value = "update";
  dialogFormVisible.value = true;
};

const resetForm = () => {
  Object.assign(dataForm, {
    name: "",
    type: groupType.value,
    description: ""
  });
  nextTick(() => {
    dataFormRef.value?.clearValidate();
  });
};

const handleDialogClosed = () => {
  dataFormRef.value?.clearValidate();
};

const handleFormSubmit = async (
  formEl: FormInstance | undefined,
  operation: "create" | "update",
  rowId?: number
) => {
  if (!formEl) return;
  if (operation === "update" && rowId === undefined) return;

  try {
    await formEl.validate();
    dataForm.type = groupType.value;

    const response =
      operation === "create"
        ? ((await createGroup(dataForm)) as ApiResponse<Group>)
        : ((await updateGroup(rowId!, dataForm)) as ApiResponse<Group>);

    if (!response.success) {
      message(
        `数据${operation === "create" ? "添加" : "更新"}失败. 错误信息: ${response.msg}`,
        {
          type: "error"
        }
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

const createForm = (formEl: FormInstance | undefined) =>
  handleFormSubmit(formEl, "create");
const updateForm = (formEl: FormInstance | undefined, rowId?: number) =>
  handleFormSubmit(formEl, "update", rowId);

const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm(
      "此操作不可撤销，确定要删除这条记录吗？",
      "提示内容",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );
    const response = (await deleteGroup(rowId)) as ApiResponse<void>;
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
      <div style=" float: right;min-width: 350px; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索" />
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
      <el-table-column prop="name" label="规则组名称" />
      <el-table-column prop="description" label="规则组描述" min-width="150" />
      <el-table-column prop="updatedAt" label="更新时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="170">
        <template #default="scope">
          <el-button
            link
            type="primary"
            size="small"
            @click="goToDetail({ id: scope.row.id }, 'params')"
          >
            {{ detailButtonText }}
          </el-button>
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
      :title="textMap[dialogStatus]"
      width="70%"
      @closed="handleDialogClosed"
    >
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item
          label="规则组名称"
          prop="name"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.name" />
        </el-form-item>
        <el-form-item
          label="规则组描述"
          prop="description"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.description" />
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
