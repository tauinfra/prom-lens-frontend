<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getNode } from '@/api/kubernetes'
import { showApiError } from "@/utils/message";
import { useNodeDetails } from "./hooks";

defineOptions({
  name: "NodeDetail"
});

interface Taint {
  key: string;
  value?: string;
  effect: string;
}

// 类型定义
interface Node {
  name: string;
  address: string;
  OSImage: string;
  OSSystem: string;
  architecture: string;
  kubeletVersion: string;
  kubeProxyVersion: string;
  kernelVersion: string;
  containerRuntimeVersion: string;
  labels: Record<string, string>;
  taints?: Taint[];
  conditions: [];
  status: string;
  machineID: string;
  systemUUID: string;
  bootID: string;
  unschedulable: boolean;
  pods: [];
  createdAt: string;
}

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T  // 后端返回错误时，无 data 字段，改为可选属性
  code: number
  msg?: string
  success: boolean
}
// 响应式数据
const data = ref<Node>({} as Node)
const { getParameter } = useNodeDetails();
const podPagination = ref({
  page: 1,
  size: 10
})

const pagedPods = computed(() => {
  const pods = Array.isArray(data.value.pods) ? data.value.pods : []
  const start = (podPagination.value.page - 1) * podPagination.value.size
  return pods.slice(start, start + podPagination.value.size)
})

const podTotal = computed(() => {
  return Array.isArray(data.value.pods) ? data.value.pods.length : 0
})

// 获取表单数据
const fetchData = async (clusterId: string, nodeName: string) => {
  try {
    const response = await getNode(clusterId, nodeName) as ApiResponse<Node>
    data.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

onMounted(() => {
  // 从路由参数获取节点信息
  const { id, name } = getParameter as { id: string; name: string };
  // 根据参数获取节点详情数据
  fetchData(id, name);
});

// 定义 Props
// 格式化污点显示
const formatTaint = (taint: Taint): string => {
  if (!taint) return '';
  if (taint.value) {
    return `${taint.key}=${taint.value}:${taint.effect}`;
  } else {
    return `${taint.key}:${taint.effect}`;
  }
};

const podErrorStatuses = new Set([
  'imagepullbackoff',
  'errimagepull',
  'crashloopbackoff',
  'oomkilled',
  'error',
  'createcontainerconfigerror',
  'containercannotrun',
  'failed'
])

const podSuccessStatuses = new Set([
  'succeeded',
  'running',
  'completed'
])

const podWarningStatuses = new Set([
  'pending',
  'waiting',
  'terminated',
  'unknown'
])

const getPodStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const normalizedStatus = (status || '').trim().toLowerCase()
  if (podErrorStatuses.has(normalizedStatus)) return 'danger'
  if (podSuccessStatuses.has(normalizedStatus)) return 'success'
  if (podWarningStatuses.has(normalizedStatus)) return 'warning'
  return 'info'
}

</script>

<template>
  <el-card shadow="never" class="node-detail-card">
    <div class="card-header" style="margin-bottom: 40px">
      <span class="card-title">节点详情 - {{ data.name }}</span>
    </div>
    <!-- 基本信息 -->
    <el-divider content-position="left">
      <span class="section-title">基本信息</span>
    </el-divider>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="节点名称" label-width="150">{{ data.name }}</el-descriptions-item>
      <el-descriptions-item label="调度状态">
        <el-tag :type="data.unschedulable ? 'warning' : 'success'" size="small">
          {{ data.unschedulable ? '不可调度' : '可调度' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="节点地址">{{data.address}}</el-descriptions-item>
      <el-descriptions-item label="Kubelet 版本" label-width="200">{{data.kubeletVersion}}</el-descriptions-item>
      <el-descriptions-item label="操作系统">{{data.OSSystem}}</el-descriptions-item>
      <el-descriptions-item label="Kube-Proxy 版本">{{data.kubeProxyVersion}}</el-descriptions-item>
      <el-descriptions-item label="系统架构">{{data.architecture}}</el-descriptions-item>
      <el-descriptions-item label="机器 ID">{{data.machineID}}</el-descriptions-item>
      <el-descriptions-item label="内核版本">{{data.kernelVersion}}</el-descriptions-item>
      <el-descriptions-item label="启动 ID">{{data.bootID}}</el-descriptions-item>
      <el-descriptions-item label="节点状态">
        <el-tag :type="data.status ? 'success' : 'warning'">
          {{ data.status ? 'Ready' : 'NotReady' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="系统 UUID">{{data.systemUUID}}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{data.createdAt}}</el-descriptions-item>
      <el-descriptions-item label="容器运行时版本">{{data.containerRuntimeVersion}}</el-descriptions-item>
      <!-- 节点标签 - 单独一行 -->
      <el-descriptions-item label="节点标签" :span="2">
        <div class="tags-container">
          <el-tag
            v-for="(value, key) in data.labels"
            :key="key"
            type="info"
            size="small"
            style="margin: 2px;"
          >
            {{ key }}{{ value ? `=${value}` : '' }}
          </el-tag>
          <el-button v-if="!data.labels || Object.keys(data.labels).length === 0" text disabled>
            无标签
          </el-button>
        </div>
      </el-descriptions-item>
      <!-- 节点污点 -->
      <el-descriptions-item
        label="节点污点"
        :span="2"
        class="full-row-item"
      >
        <div class="tags-container">
          <el-tag
            v-for="(taint, index) in data.taints"
            :key="index"
            class="taint-tag"
            size="small"
            closable
          >
            {{ formatTaint(taint) }}
          </el-tag>
          <el-button v-if="data.taints && data.taints.length === 0" text disabled>
            无污点
          </el-button>
        </div>
      </el-descriptions-item>
    </el-descriptions>

    <!-- 节点状态 -->
    <el-divider content-position="left">
      <span class="section-title">节点状态</span>
    </el-divider>

    <el-table :data="data.conditions" style="width: 100%">
      <el-table-column fixed prop="type" label="类型" width="180"></el-table-column>
      <el-table-column prop="status" label="状态" width="120"></el-table-column>
      <el-table-column prop="lastHeartbeatTime" label="最近一次心跳" width="200"></el-table-column>
      <el-table-column prop="lastTransitionTime" label="最近一次修改" width="200"></el-table-column>
      <el-table-column prop="reason" label="原因"></el-table-column>
      <el-table-column prop="message" label="信息"></el-table-column>
    </el-table>

    <!-- Pod 列表 -->
    <el-divider content-position="left">
      <span class="section-title">Pod 列表</span>
    </el-divider>

    <el-table :data="pagedPods" style="width: 100%">
      <el-table-column fixed prop="name" label="Pod 名称"></el-table-column>
      <el-table-column prop="namespace" label="命名空间" width="245"></el-table-column>
      <el-table-column prop="status" label="状态" width="150">
        <template #default="scope">
          <el-tag :type="getPodStatusType(scope.row.status)" size="small">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="restartCount" label="重启" width="180" align="center"></el-table-column>
      <el-table-column prop="podIP" label="Pod IP" width="180"></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180"></el-table-column>
    </el-table>
    <el-pagination
      background
      v-model:current-page="podPagination.page"
      v-model:page-size="podPagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      :total="podTotal"
      style="float: right; margin-top: 12px;"
    />
  </el-card>
</template>

<style scoped lang="scss">
</style>
