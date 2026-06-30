<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from "vue";
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  verifyWebhook
} from "@/api/alerting";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { Plus, Refresh, DocumentCopy, Delete } from "@element-plus/icons-vue";
import { copyTextToClipboard } from "@pureadmin/utils";
import type { FormInstance, FormRules } from "element-plus";
import {
  usePaginatedSearch,
  type Pagination
} from "@/utils/hooks/usePaginatedSearch";
import { formatDate } from "@/utils/date";

defineOptions({ name: "AlertingWebhook" });

interface RouteMatcher {
  label: string;
  operator: string;
  value: string;
}

interface WebhookRoute {
  priority: number;
  matchers: RouteMatcher[];
}

interface Webhook {
  id: number;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  callbackToken?: string;
  route?: WebhookRoute;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T = unknown> {
  data?: T;
  pagination?: Pagination;
  code: number;
  msg?: string;
  success: boolean;
}

const operatorOptions = [
  { label: "=", value: "=" },
  { label: "!=", value: "!=" },
  { label: "=~", value: "=~" },
  { label: "!~", value: "!~" }
];

const createEmptyMatcher = (): RouteMatcher => ({
  label: "",
  operator: "=",
  value: ""
});

const createDefaultRoute = (): WebhookRoute => ({
  priority: 10,
  matchers: [createEmptyMatcher()]
});

const data = ref<Webhook[]>([]);
const dialogStatus = ref<"create" | "update">("create");
const dialogFormVisible = ref(false);
const dataFormRef = ref<FormInstance>();
const formLabelWidth = "100px";
const currentEditId = ref<number>();
const testLoading = ref(false);
const testingRowId = ref<number>();
const detailDrawerVisible = ref(false);
const currentDetail = ref<Webhook | null>(null);

const dataForm = reactive<
  Omit<Webhook, "id" | "createdAt" | "updatedAt" | "callbackToken">
>({
  name: "",
  url: "",
  description: "",
  enabled: true,
  route: createDefaultRoute()
});

const rules = reactive<FormRules>({
  name: [{ required: true, message: "请输入通道名称.", trigger: "blur" }],
  url: [
    { required: true, message: "请输入通道地址.", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback();
          return;
        }
        try {
          const parsed = new URL(String(value).trim());
          if (parsed.protocol !== "https:") {
            callback(new Error("通道地址须以 https:// 开头."));
            return;
          }
          callback();
        } catch {
          callback(new Error("请输入有效的通道地址."));
        }
      },
      trigger: "blur"
    }
  ],
  "route.priority": [
    { required: true, message: "请输入路由优先级.", trigger: "blur" }
  ]
});

const textMap = { update: "更新通道", create: "创建通道" };

const formatCallbackToken = (token?: string) => {
  if (!token) return "-";
  if (token.includes("*") || token.endsWith("...")) return token;
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}****${token.slice(-4)}`;
};

const getPromLensBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
};

const yamlScalar = (value: string) => {
  if (!value) return '""';
  if (/^[a-zA-Z0-9_.-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
};

const formatMatcherAlertmanager = (matcher: RouteMatcher) => {
  const label = matcher.label.trim();
  const value = matcher.value.trim();
  if (!label || !value) return "";

  switch (matcher.operator) {
    case "!=":
      return `${label}!="${value}"`;
    case "=~":
      return `${label}=~"${value}"`;
    case "!~":
      return `${label}!~"${value}"`;
    default:
      return `${label}="${value}"`;
  }
};

const formatAlertmanagerConfig = (webhook: Webhook) => {
  const baseUrl = getPromLensBaseUrl();
  const name = yamlScalar(webhook.name);
  const callbackToken = yamlScalar(webhook.callbackToken ?? "");
  const webhookUrl = `${baseUrl}/api/v1/alerting/webhook/${webhook.name}`;

  const lines = [
    "receivers:",
    `  - name: ${name}`,
    "    webhook_configs:",
    `      - url: ${yamlScalar(webhookUrl)}`,
    "        send_resolved: true",
    "        http_config:",
    `          bearer_token: ${callbackToken}`
  ];

  const matchers = (webhook.route?.matchers ?? [])
    .map(formatMatcherAlertmanager)
    .filter(Boolean);

  if (matchers.length > 0) {
    lines.push(
      "route:",
      "  routes:",
      `    - receiver: ${name}`,
      "      matchers:"
    );
    for (const matcher of matchers) {
      lines.push(`        - ${matcher}`);
    }
    lines.push("      continue: false");
  }

  return lines.join("\n");
};

const currentAlertmanagerConfig = computed(() =>
  currentDetail.value ? formatAlertmanagerConfig(currentDetail.value) : ""
);

const currentRoutePolicyTags = computed(() => {
  const route = currentDetail.value?.route;
  if (!route) return [];

  const tags = [`P${route.priority}`];
  for (const item of route.matchers ?? []) {
    if (item.label.trim() && item.value.trim()) {
      tags.push(`${item.label}${item.operator}${item.value}`);
    }
  }
  return tags;
});

const copyAlertmanagerConfig = async () => {
  const config = currentAlertmanagerConfig.value;
  if (!config) {
    message("暂无可复制的配置", { type: "warning" });
    return;
  }
  const success = copyTextToClipboard(config);
  if (success) {
    message("Alertmanager 配置已复制", { type: "success" });
  } else {
    message("复制失败", { type: "error" });
  }
};

const copyCallbackToken = async (token?: string) => {
  if (!token) {
    message("暂无可复制的回调令牌", { type: "warning" });
    return;
  }
  const success = copyTextToClipboard(token);
  if (success) {
    message("回调令牌 已复制", { type: "success" });
  } else {
    message("复制失败", { type: "error" });
  }
};

const addMatcher = () => {
  dataForm.route.matchers.push(createEmptyMatcher());
};

const removeMatcher = (index: number) => {
  if (dataForm.route.matchers.length <= 1) {
    message("至少保留一条匹配规则.", { type: "warning" });
    return;
  }
  dataForm.route.matchers.splice(index, 1);
};

const cloneRoute = (route?: WebhookRoute): WebhookRoute => {
  if (!route) return createDefaultRoute();
  return {
    priority: route.priority ?? 10,
    matchers:
      route.matchers?.length > 0
        ? route.matchers.map(item => ({ ...item }))
        : [createEmptyMatcher()]
  };
};

const buildSubmitPayload = () => {
  const matchers = dataForm.route.matchers.filter(
    item => item.label.trim() && item.value.trim()
  );
  return {
    name: dataForm.name,
    url: dataForm.url,
    description: dataForm.description,
    enabled: dataForm.enabled,
    route: {
      priority: dataForm.route.priority,
      matchers: matchers.map(item => ({
        label: item.label.trim(),
        operator: item.operator,
        value: item.value.trim()
      }))
    }
  };
};

const validateMatchers = () => {
  for (const item of dataForm.route.matchers) {
    const hasLabel = Boolean(item.label.trim());
    const hasValue = Boolean(item.value.trim());
    if (hasLabel !== hasValue) {
      message("匹配规则的标签和值需同时填写.", { type: "warning" });
      return false;
    }
  }
  return true;
};

async function fetchWebhooks(p: Pagination) {
  try {
    const response = (await getWebhooks({
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword
    })) as ApiResponse<Webhook[]>;
    data.value = response.data ?? [];
    pagination.value.total = response.pagination?.total ?? 0;
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败");
  }
}

const { pagination, refresh } = usePaginatedSearch(fetchWebhooks, {
  debounceTime: 1000,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: "id",
  initialSortOrder: "asc"
});

const refreshClick = () => refresh();

onMounted(() => {
  refresh();
});

const resetForm = () => {
  Object.assign(dataForm, {
    name: "",
    url: "",
    description: "",
    enabled: true,
    route: createDefaultRoute()
  });
  nextTick(() => dataFormRef.value?.clearValidate());
};

const handleDialogClosed = () => dataFormRef.value?.clearValidate();

const sendTestMessage = async (response: ApiResponse) => {
  if (!response.success) {
    message(`测试消息发送失败: ${response.msg}`, { type: "error" });
    return false;
  }
  message("测试消息已发送，请检查通知渠道是否收到", { type: "success" });
  return true;
};

const verifyWebhookUrl = async (url: string) => {
  const response = (await verifyWebhook({
    url: url.trim()
  })) as ApiResponse;
  return sendTestMessage(response);
};

const handleSendTest = async (row: Webhook) => {
  testingRowId.value = row.id;
  testLoading.value = true;
  try {
    await verifyWebhookUrl(row.url);
  } catch (error) {
    message(error instanceof Error ? error.message : "测试消息发送失败", {
      type: "error"
    });
  } finally {
    testLoading.value = false;
    testingRowId.value = undefined;
  }
};

const handleDialogTest = async () => {
  if (!dataFormRef.value) return;

  try {
    await dataFormRef.value.validateField(["url"]);
  } catch {
    return;
  }

  testLoading.value = true;
  try {
    await verifyWebhookUrl(dataForm.url);
  } catch (error) {
    message(error instanceof Error ? error.message : "测试消息发送失败", {
      type: "error"
    });
  } finally {
    testLoading.value = false;
  }
};

const promptSendTestAfterCreate = async (webhook?: Webhook) => {
  if (!webhook?.url) return;

  try {
    await ElMessageBox.confirm(
      "通知渠道已创建，是否立即发送测试消息？",
      "发送测试",
      {
        confirmButtonText: "发送测试",
        cancelButtonText: "稍后",
        type: "info"
      }
    );
    await verifyWebhookUrl(webhook.url);
  } catch {
    // 用户选择稍后
  }
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
    if (!validateMatchers()) return;

    const payload = buildSubmitPayload();
    const response =
      operation === "create"
        ? ((await createWebhook(payload)) as ApiResponse<Webhook>)
        : ((await updateWebhook(rowId!, payload)) as ApiResponse<Webhook>);

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

    if (operation === "create") {
      await promptSendTestAfterCreate(response.data as Webhook | undefined);
    }
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
      "此操作不可撤销，确定要删除这条记录吗？",
      "提示",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );

    const response = (await deleteWebhook(rowId)) as ApiResponse<void>;
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

const editClick = (row: Webhook) => {
  currentEditId.value = row.id;
  Object.assign(dataForm, {
    name: row.name,
    url: row.url,
    description: row.description,
    enabled: row.enabled,
    route: cloneRoute(row.route)
  });
  dialogStatus.value = "update";
  dialogFormVisible.value = true;
};

const detailClick = (row: Webhook) => {
  currentDetail.value = row;
  detailDrawerVisible.value = true;
};

const testFromDetail = async () => {
  if (!currentDetail.value) return;
  await handleSendTest(currentDetail.value);
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
      <el-table-column prop="name" label="通道名称" />
      <el-table-column
        prop="url"
        label="通道地址"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column
        prop="description"
        label="通道描述"
        show-overflow-tooltip
      />
      <el-table-column prop="enabled" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? "启用" : "禁用" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="detailClick(row)">
            详情
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            :loading="testLoading && testingRowId === row.id"
            @click="handleSendTest(row)"
          >
            测试
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
          label="通道名称"
          prop="name"
          :label-width="formLabelWidth"
        >
          <el-input
            v-model="dataForm.name"
            placeholder="例如 hk-prod-receiver"
          />
        </el-form-item>
        <el-form-item label="通道地址" prop="url" :label-width="formLabelWidth">
          <el-input
            v-model="dataForm.url"
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          />
        </el-form-item>
        <el-form-item
          label="通道描述"
          prop="description"
          :label-width="formLabelWidth"
        >
          <el-input
            v-model="dataForm.description"
            type="textarea"
            :rows="2"
            placeholder="例如 生产服务告警"
          />
        </el-form-item>
        <el-form-item
          label="启用状态"
          prop="enabled"
          :label-width="formLabelWidth"
        >
          <el-switch v-model="dataForm.enabled" />
        </el-form-item>

        <el-divider content-position="left" class="route-config-divider">
          路由配置
        </el-divider>

        <el-form-item
          label="优先级"
          prop="route.priority"
          :label-width="formLabelWidth"
        >
          <el-input-number
            v-model="dataForm.route.priority"
            :min="0"
            :max="9999"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="匹配规则" :label-width="formLabelWidth">
          <div class="matcher-list">
            <div
              v-for="(matcher, index) in dataForm.route.matchers"
              :key="index"
              class="matcher-row"
            >
              <el-input
                v-model="matcher.label"
                placeholder="标签，如 environment"
                class="matcher-row__label"
              />
              <el-select
                v-model="matcher.operator"
                class="matcher-row__operator"
              >
                <el-option
                  v-for="item in operatorOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-input
                v-model="matcher.value"
                placeholder="值，如 prod"
                class="matcher-row__value"
              />
              <el-button
                link
                type="danger"
                :icon="Delete"
                title="删除规则"
                @click="removeMatcher(index)"
              />
            </div>
            <el-button type="primary" link @click="addMatcher"
              >添加匹配规则</el-button
            >
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="testLoading" @click="handleDialogTest">
            发送测试
          </el-button>
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

    <el-drawer
      v-model="detailDrawerVisible"
      title="通道详情"
      size="42%"
      direction="rtl"
      :modal="false"
      modal-penetrable
    >
      <template v-if="currentDetail">
        <el-divider content-position="left" class="route-config-divider">
          通道配置
        </el-divider>

        <el-descriptions
          class="drawer-detail-info"
          :column="1"
          size="large"
          direction="horizontal"
          label-width="100px"
        >
          <el-descriptions-item label="通道名称">
            <el-tooltip
              :content="currentDetail.name"
              placement="top"
              :disabled="!currentDetail.name"
            >
              <span class="detail-value">{{ currentDetail.name || "-" }}</span>
            </el-tooltip>
          </el-descriptions-item>
          <el-descriptions-item
            label="通道地址"
            label-class-name="channel-url-label"
            class-name="channel-url-content"
          >
            <el-tooltip
              :content="currentDetail.url"
              placement="top"
              :disabled="!currentDetail.url"
            >
              <span class="detail-value">{{ currentDetail.url || "-" }}</span>
            </el-tooltip>
          </el-descriptions-item>
          <el-descriptions-item label="通道描述">
            <el-tooltip
              :content="currentDetail.description"
              placement="top"
              :disabled="!currentDetail.description"
            >
              <span class="detail-value">{{
                currentDetail.description || "-"
              }}</span>
            </el-tooltip>
          </el-descriptions-item>
          <el-descriptions-item label="启用状态">
            <el-tag
              :type="currentDetail.enabled ? 'success' : 'info'"
              size="small"
            >
              {{ currentDetail.enabled ? "启用" : "禁用" }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="路由策略">
            <div v-if="currentRoutePolicyTags.length" class="route-policy-tags">
              <el-tag
                v-for="(tag, index) in currentRoutePolicyTags"
                :key="index"
                size="small"
                :type="index === 0 ? 'warning' : 'info'"
              >
                {{ tag }}
              </el-tag>
            </div>
            <span v-else class="detail-value">-</span>
          </el-descriptions-item>
          <el-descriptions-item
            label="回调令牌"
            label-class-name="callback-token-label"
            class-name="callback-token-content"
          >
            <div v-if="currentDetail.callbackToken" class="callback-token-cell">
              <el-tooltip
                :content="currentDetail.callbackToken"
                placement="top"
              >
                <span class="detail-value detail-value--mono">
                  {{ formatCallbackToken(currentDetail.callbackToken) }}
                </span>
              </el-tooltip>
              <el-button
                link
                type="primary"
                :icon="DocumentCopy"
                class="callback-token-cell__copy"
                title="复制回调令牌"
                @click="copyCallbackToken(currentDetail.callbackToken)"
              />
            </div>
            <span v-else class="detail-value">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            <span class="detail-value">{{
              formatDate(currentDetail.createdAt)
            }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            <span class="detail-value">{{
              formatDate(currentDetail.updatedAt)
            }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left" class="route-config-divider">
          路由配置
        </el-divider>

        <div class="alertmanager-config">
          <div class="alertmanager-config__header">
            <span class="alertmanager-config__title">Alertmanager 配置</span>
            <el-button
              link
              type="primary"
              :icon="DocumentCopy"
              @click="copyAlertmanagerConfig"
            >
              复制配置
            </el-button>
          </div>
          <pre class="alertmanager-config__pre">{{
            currentAlertmanagerConfig
          }}</pre>
        </div>
      </template>

      <template #footer>
        <div class="drawer-footer">
          <el-button
            :loading="testLoading && testingRowId === currentDetail?.id"
            @click="testFromDetail"
          >
            发送测试
          </el-button>
          <el-button @click="detailDrawerVisible = false">关 闭</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.route-config-divider:deep(.el-divider__text) {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.drawer-detail-info :deep(.el-descriptions__table) {
  width: 100%;
  table-layout: fixed;
}

.drawer-detail-info :deep(td.el-descriptions__cell) {
  overflow: hidden;
  white-space: nowrap;
}

.drawer-detail-info :deep(.el-descriptions__label) {
  font-weight: 600;
  vertical-align: middle;
  white-space: nowrap;
}

.drawer-detail-info :deep(.el-descriptions__content) {
  display: inline-block;
  min-width: 0;
  max-width: calc(100% - 108px);
  overflow: hidden;
  vertical-align: middle;
  white-space: nowrap;
}

.drawer-detail-info :deep(.callback-token-label),
.drawer-detail-info :deep(.callback-token-content),
.drawer-detail-info :deep(.channel-url-label),
.drawer-detail-info :deep(.channel-url-content) {
  vertical-align: middle;
  white-space: nowrap;
}

.drawer-detail-info :deep(.el-descriptions__content .el-tooltip__trigger) {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-detail-info :deep(.el-descriptions__body) {
  padding: 4px 14px;
  background: #f5f7fa;
  border-radius: 6px;
}

:deep(.drawer-detail-info .el-descriptions__cell) {
  padding-bottom: 2px !important;
}

.detail-value {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-value--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.route-policy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.alertmanager-config__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.alertmanager-config__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.alertmanager-config__pre {
  padding: 12px 14px;
  margin: 0;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #abb2bf;
  white-space: pre;
  background: #282c34;
  border-radius: 6px;
}

.callback-token-cell {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
  max-width: 100%;
  vertical-align: middle;
}

.callback-token-cell .detail-value {
  flex: 1 1 auto;
  min-width: 0;
}

.callback-token-cell__copy {
  flex: 0 0 auto;
}

.callback-token-cell__text {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
}

.matcher-list {
  width: 100%;
}

.matcher-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.matcher-row__label {
  width: 160px;
}

.matcher-row__operator {
  width: 90px;
}

.matcher-row__value {
  flex: 1;
}
</style>
