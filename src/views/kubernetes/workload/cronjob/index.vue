<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  getClusters,
  getNamespaces,
  getCronJobs,
  getCronJob,
  createCronJob,
  updateCronJob,
  deleteCronJob
} from "@/api/kubernetes";
import { message, showApiError } from "@/utils/message";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { CascaderProps, ElMessageBox } from "element-plus";
import yaml from "js-yaml";
import YamlEditor from "@/components/YamlEditor/index.vue";

defineOptions({
  name: "CronJob"
});

interface ApiResponse<T = any> {
  data?: T
  code: number
  msg?: string
  success: boolean
}

interface Pagination {
  page: number
  size: number
  total: number
  sortBy: string
  sortOrder: "asc" | "desc"
  keyword: string
}

interface CronJobRow {
  name?: string
  schedule?: string
  suspend?: boolean
  active?: number
  lastScheduleTime?: string
  createdAt?: string
  [key: string]: unknown
}

const pagination = ref<Pagination>({
  page: 1,
  size: 10,
  total: 0,
  sortBy: "id",
  sortOrder: "asc",
  keyword: ""
});

const clusterId = ref<number>();
const namespace = ref<string>();
const name = ref("");
const data = ref<CronJobRow[]>([]);
const yamlContent = ref("");
const dialogVisible = ref(false);
const dialogStatus = ref<"create" | "update">("create");

const hasValidSelection = computed(() => clusterId.value !== undefined && namespace.value !== undefined);

const normalizeSearchValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }
  if (Array.isArray(value)) return value.map(item => normalizeSearchValue(item)).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(item => normalizeSearchValue(item))
      .join(" ");
  }
  return "";
};

const filteredData = computed(() => {
  const kw = (pagination.value.keyword || "").trim().toLowerCase();
  if (!kw) return data.value;
  return data.value.filter(item => Object.values(item).some(value => normalizeSearchValue(value).includes(kw)));
});

const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size;
  return filteredData.value.slice(start, start + pagination.value.size);
});

watch(() => pagination.value.keyword, () => {
  pagination.value.page = 1;
});
watch(filteredData, val => {
  pagination.value.total = val.length;
}, { immediate: true });

const cascaderProps: CascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, data: nodeData } = node;
    try {
      if (level === 0) {
        const clusters = await fetchClusters();
        resolve(
          clusters.map((cluster: { id: number; name: string }) => ({
            value: cluster.id,
            label: cluster.name,
            leaf: false
          }))
        );
      } else if (level === 1) {
        const cid = nodeData.value;
        const namespaces = await fetchNamespaces(cid as number);
        resolve(
          namespaces.map((ns: { name: string }) => ({
            value: ns.name,
            label: ns.name,
            leaf: true
          }))
        );
      } else {
        resolve([]);
      }
    } catch (error) {
      showApiError(error);
      resolve([]);
    }
  }
};

const handleCascaderChange = async (value: string[]) => {
  if (value && value.length === 2) {
    clusterId.value = parseInt(value[0]);
    namespace.value = value[1];
    pagination.value.page = 1;
    await fetchCronJobsData(clusterId.value, namespace.value);
  } else {
    data.value = [];
  }
};

const fetchClusters = async () => {
  try {
    const response = await getClusters({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword
    }) as ApiResponse<[]>;
    return response.data || [];
  } catch (error) {
    showApiError(error);
    return [];
  }
};

const fetchNamespaces = async (cid: number) => {
  try {
    const response = await getNamespaces(cid) as ApiResponse<[]>;
    return response.data || [];
  } catch (error) {
    showApiError(error);
    return [];
  }
};

const fetchCronJobsData = async (cid: number, ns: string) => {
  try {
    const response = await getCronJobs(cid, ns) as ApiResponse<CronJobRow[]>;
    data.value = response.data ?? [];
  } catch (error) {
    showApiError(error);
  }
};

const fetchCronJobYaml = async (cid: number, ns: string, cronJobName: string) => {
  try {
    const response = await getCronJob(cid, ns, cronJobName) as ApiResponse<any>;
    yamlContent.value = jsonToYaml(response.data);
  } catch (error) {
    showApiError(error);
  }
};

const refreshClick = () => {
  if (!hasValidSelection.value) {
    message("请先选择集群和命名空间", { type: "warning", duration: 5000 });
    return;
  }
  fetchCronJobsData(clusterId.value!, namespace.value!);
};

const handleCreateClick = () => {
  if (!hasValidSelection.value) {
    message("请先选择集群和命名空间", { type: "warning", duration: 5000 });
    return;
  }
  dialogStatus.value = "create";
  name.value = "";
  yamlContent.value = "";
  dialogVisible.value = true;
};

const handleYamlClick = (row: CronJobRow) => {
  name.value = String(row.name || "");
  dialogStatus.value = "update";
  fetchCronJobYaml(clusterId.value!, namespace.value!, name.value);
  dialogVisible.value = true;
};

const jsonToYaml = (jsonData: any) => {
  try {
    return yaml.dump(jsonData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      skipInvalid: true
    });
  } catch (error) {
    console.error("JSON 转 YAML 失败:", error);
    return "";
  }
};

const handleSubmit = async (operation: "create" | "update") => {
  try {
    const jsonData = yaml.load(yamlContent.value);
    const response = operation === "create"
      ? await createCronJob(clusterId.value!, namespace.value!, jsonData) as ApiResponse
      : await updateCronJob(clusterId.value!, namespace.value!, name.value, jsonData) as ApiResponse;

    if (!response.success) {
      showApiError(`CronJob ${operation === "create" ? "创建" : "更新"}失败. 错误信息: ${response.msg}`);
      return;
    }
    dialogVisible.value = false;
    await fetchCronJobsData(clusterId.value!, namespace.value!);
    message(`CronJob ${operation === "create" ? "创建" : "更新"}成功!`, { type: "success", duration: 5000 });
  } catch (error) {
    showApiError((error as Error)?.message || error);
  }
};

const handleDelete = async (cronJobName: string) => {
  try {
    await ElMessageBox.confirm(
      "此操作不可撤销，确定要执行删除操作吗？",
      "提示内容",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const response = await deleteCronJob(clusterId.value!, namespace.value!, cronJobName) as ApiResponse;
    if (!response.success) {
      showApiError(`资源 '${cronJobName}' 删除失败. 错误信息: ${response.msg}`);
      return;
    }
    await fetchCronJobsData(clusterId.value!, namespace.value!);
    message("数据删除成功!", { type: "success", duration: 5000 });
  } catch (error) {
    if (error !== "cancel") {
      showApiError((error as Error)?.message || error);
    } else {
      message("已取消删除操作!", { type: "info", duration: 5000 });
    }
  }
};
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索" />
      </div>
      <el-cascader
        :props="cascaderProps"
        placeholder="选择集群 / 命名空间"
        style="min-width: 300px"
        @change="handleCascaderChange"
      />
      <el-button type="primary" plain style="margin-left: 5px" @click="handleCreateClick">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="pagedData" stripe>
      <el-table-column fixed prop="name" label="名称" show-overflow-tooltip />
      <el-table-column prop="schedule" label="调度表达式" min-width="160" />
      <el-table-column label="暂停" width="90">
        <template #default="scope">
          {{ scope.row.suspend ? "是" : "否" }}
        </template>
      </el-table-column>
      <el-table-column prop="active" label="运行中任务数" width="120" />
      <el-table-column prop="lastScheduleTime" label="最近调度时间" width="170" />
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column fixed="right" label="操作" width="160">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="handleYamlClick(scope.row)">
            编辑 YAML
          </el-button>
          <el-button link type="primary" size="small" @click="handleDelete(scope.row.name)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right"
    />

    <el-dialog title="YAML" v-model="dialogVisible" width="60%">
      <el-form>
        <YamlEditor v-model="yamlContent" style="height: 550px" />
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="dialogStatus === 'create' ? handleSubmit('create') : handleSubmit('update')">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
</style>
