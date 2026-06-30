<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from "vue";
import {
  getUsers,
  createUser,
  deleteUser,
  updateUser,
  userResetPassword
} from "@/api/authn";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  usePaginatedSearch,
  type Pagination
} from "@/utils/hooks/usePaginatedSearch";
import { formatDate } from "@/utils/date";

defineOptions({ name: "AuthnUser" });

interface User {
  id: number;
  username: string;
  password?: string;
  nickname?: string;
  email: string;
  phone?: string;
  isActive?: boolean;
  isSuperuser?: boolean;
  creator?: string;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T = unknown> {
  data?: T;
  pagination?: Pagination;
  code: number;
  msg?: string;
  success: boolean;
}

const data = ref<User[]>([]);
const dialogStatus = ref<"create" | "update">("create");
const dialogFormVisible = ref(false);
const resetPwdDialogVisible = ref(false);
const dataFormRef = ref<FormInstance>();
const resetPwdFormRef = ref<FormInstance>();
const formLabelWidth = "100px";
const currentEditId = ref<number>();
const currentUser = ref<User | null>(null);

const dataForm = reactive({
  username: "",
  password: "",
  nickname: "",
  email: "",
  phone: "",
  isActive: true,
  isSuperuser: false
});

const resetPwdForm = reactive({ newPassword: "" });

const rules = computed<FormRules>(() => ({
  username: [{ required: true, message: "请输入用户账号.", trigger: "blur" }],
  password:
    dialogStatus.value === "create"
      ? [
          { required: true, message: "请输入用户密码.", trigger: "blur" },
          { min: 6, message: "密码至少 6 位.", trigger: "blur" }
        ]
      : [],
  email: [
    { required: true, message: "请输入用户邮箱.", trigger: "blur" },
    { type: "email", message: "请输入有效邮箱.", trigger: "blur" }
  ]
}));

const resetPwdRules = reactive<FormRules>({
  newPassword: [
    { required: true, message: "请输入新密码.", trigger: "blur" },
    { min: 6, message: "密码至少 6 位.", trigger: "blur" }
  ]
});

const textMap = { update: "更新用户", create: "创建用户" };

async function fetchUsers(p: Pagination) {
  try {
    const response = (await getUsers({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword
    })) as ApiResponse<User[]>;

    if (!response.success) {
      message(response.msg || "获取用户列表失败", { type: "error" });
      return;
    }

    data.value = response.data ?? [];
    pagination.value.total = response.pagination?.total ?? 0;
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败", {
      type: "error"
    });
  }
}

const { pagination, refresh } = usePaginatedSearch(fetchUsers, {
  debounceTime: 800,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: "id",
  initialSortOrder: "asc"
});

onMounted(() => {
  refresh();
});

const resetForm = () => {
  Object.assign(dataForm, {
    username: "",
    password: "",
    nickname: "",
    email: "",
    phone: "",
    isActive: true,
    isSuperuser: false
  });
  nextTick(() => dataFormRef.value?.clearValidate());
};

const resetPwdFormReset = () => {
  resetPwdForm.newPassword = "";
  nextTick(() => resetPwdFormRef.value?.clearValidate());
};

const handleDialogClosed = () => dataFormRef.value?.clearValidate();
const handleResetPwdDialogClosed = () => resetPwdFormRef.value?.clearValidate();

const buildCreatePayload = () => ({
  username: dataForm.username.trim(),
  password: dataForm.password,
  nickname: dataForm.nickname.trim(),
  email: dataForm.email.trim(),
  phone: dataForm.phone.trim() || undefined,
  isActive: dataForm.isActive,
  isSuperuser: dataForm.isSuperuser
});

const buildUpdatePayload = () => ({
  username: dataForm.username.trim(),
  nickname: dataForm.nickname.trim(),
  email: dataForm.email.trim(),
  phone: dataForm.phone.trim() || undefined,
  isActive: dataForm.isActive,
  isSuperuser: dataForm.isSuperuser
});

const handleFormSubmit = async (
  formEl: FormInstance | undefined,
  operation: "create" | "update",
  rowId?: number
) => {
  if (!formEl) return;
  if (operation === "update" && rowId === undefined) return;

  try {
    await formEl.validate();
    const response =
      operation === "create"
        ? ((await createUser(buildCreatePayload())) as ApiResponse)
        : ((await updateUser(rowId!, buildUpdatePayload())) as ApiResponse);

    if (!response.success) {
      message(
        `数据${operation === "create" ? "添加" : "更新"}失败: ${response.msg}`,
        { type: "error" }
      );
      return;
    }

    refresh();
    dialogFormVisible.value = false;
    message(`数据${operation === "create" ? "添加" : "更新"}成功!`, {
      type: "success"
    });
  } catch (error) {
    message(error instanceof Error ? error.message : "操作失败", {
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
      "此操作不可撤销，确定要执行删除操作吗？",
      "提示",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );

    const response = (await deleteUser(rowId)) as ApiResponse<void>;
    if (!response.success) {
      message(`删除失败: ${response.msg}`, { type: "error" });
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

const addClick = () => {
  dialogStatus.value = "create";
  resetForm();
  dialogFormVisible.value = true;
};

const editClick = (row: User) => {
  currentEditId.value = row.id;
  Object.assign(dataForm, {
    username: row.username,
    password: "",
    nickname: row.nickname ?? "",
    email: row.email,
    phone: row.phone ?? "",
    isActive: row.isActive ?? true,
    isSuperuser: row.isSuperuser ?? false
  });
  dialogStatus.value = "update";
  dialogFormVisible.value = true;
};

const resetPwdClick = (row: User) => {
  currentEditId.value = row.id;
  currentUser.value = row;
  resetPwdFormReset();
  resetPwdDialogVisible.value = true;
};

const handleResetPwdSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl || currentEditId.value === undefined) return;

  try {
    await formEl.validate();
    const response = (await userResetPassword(currentEditId.value, {
      newPassword: resetPwdForm.newPassword
    })) as ApiResponse<void>;

    if (!response.success) {
      message(`重置密码失败: ${response.msg}`, { type: "error" });
      return;
    }

    message("重置密码成功!", { type: "success" });
    resetPwdDialogVisible.value = false;
  } catch (error) {
    message(error instanceof Error ? error.message : "操作失败", {
      type: "error"
    });
  }
};

const refreshClick = () => refresh();
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style=" float: right;min-width: 350px; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索" />
      </div>
      <el-button type="primary" plain @click="addClick">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button
        type="info"
        plain
        style="margin-left: 5px"
        @click="refreshClick"
      >
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="username" label="用户账号" />
      <el-table-column prop="nickname" label="用户昵称" />
      <el-table-column prop="email" label="用户邮箱" />
      <el-table-column prop="isActive" label="用户状态">
        <template #default="{ row }">
          <IconifyIconOnline
            v-if="row.isActive"
            icon="mdi:check-circle"
            class="status-icon status-icon--ok"
          />
          <IconifyIconOnline
            v-else
            icon="mdi:close-circle"
            class="status-icon status-icon--no"
          />
        </template>
      </el-table-column>
      <el-table-column prop="isSuperuser" label="管理员">
        <template #default="{ row }">
          <IconifyIconOnline
            v-if="row.isSuperuser"
            icon="mdi:check-circle"
            class="status-icon status-icon--ok"
          />
          <IconifyIconOnline
            v-else
            icon="mdi:close-circle"
            class="status-icon status-icon--no"
          />
        </template>
      </el-table-column>
      <el-table-column prop="lastLogin" label="最后登录" width="170">
        <template #default="{ row }">
          {{ formatDate(row.lastLogin) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="170">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            size="small"
            @click="resetPwdClick(row)"
          >
            重置密码
          </el-button>
          <el-button link type="primary" size="small" @click="editClick(row)">
            编辑
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            @click="handleDelete(row.id)"
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
      width="50%"
      @closed="handleDialogClosed"
    >
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item
          label="用户账号"
          prop="username"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.username" placeholder="请输入用户账号" />
        </el-form-item>
        <el-form-item
          v-if="dialogStatus === 'create'"
          label="用户密码"
          prop="password"
          :label-width="formLabelWidth"
        >
          <el-input
            v-model="dataForm.password"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="用户昵称" :label-width="formLabelWidth">
          <el-input v-model="dataForm.nickname" placeholder="请输入用户昵称" />
        </el-form-item>
        <el-form-item
          label="用户邮箱"
          prop="email"
          :label-width="formLabelWidth"
        >
          <el-input v-model="dataForm.email" placeholder="请输入用户邮箱" />
        </el-form-item>
        <el-form-item label="手机号码" :label-width="formLabelWidth">
          <el-input v-model="dataForm.phone" placeholder="请输入手机号码" />
        </el-form-item>
        <el-form-item label="启用状态" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.isActive" />
        </el-form-item>
        <el-form-item label="超级管理员" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.isSuperuser" />
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

    <el-dialog
      v-model="resetPwdDialogVisible"
      title="重置密码"
      width="40%"
      @closed="handleResetPwdDialogClosed"
    >
      <el-form
        ref="resetPwdFormRef"
        :model="resetPwdForm"
        :rules="resetPwdRules"
      >
        <el-form-item label="用户账号" :label-width="formLabelWidth">
          <el-input :model-value="currentUser?.username" disabled />
        </el-form-item>
        <el-form-item
          label="新密码"
          prop="newPassword"
          :label-width="formLabelWidth"
        >
          <el-input
            v-model="resetPwdForm.newPassword"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="resetPwdDialogVisible = false">取 消</el-button>
          <el-button
            type="primary"
            @click="handleResetPwdSubmit(resetPwdFormRef)"
          >
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.status-icon {
  font-size: 16px;
  vertical-align: middle;
}

.status-icon--ok {
  color: #67c23a;
}

.status-icon--no {
  color: #f56c6c;
}
</style>
