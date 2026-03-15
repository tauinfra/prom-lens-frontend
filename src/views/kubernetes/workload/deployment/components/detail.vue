<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { getDeploymentDetail, getPods, getReplicaSets, getServices, rolloutDeployment, deletePod } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { useDetailRoutes } from "@/utils/hooks/useDetailRoute";
import {ElMessageBox, TabsPaneContext} from 'element-plus';
import "codemirror/theme/dracula.css";

defineOptions({
  name: "DeploymentDetail"
});

interface DeploymentCondition {
  type: string
  status: string
  lastTransitionTime: string
  lastProbeTime: string
  reason?: string
  message?: string
}

interface Deployment {
  namespace: string
  name: string
  matchLabels: Record<string, string>
  replicas: number
  readyReplicas: number
  updatedReplicas: string
  availableReplicas: number
  strategy: Record<string, string>
  conditions: DeploymentCondition[]
  createdAt: string
  updatedAt: string
}

interface Pod {
  namespace: string
  name: string
  podIP: string
  hostIP: string
  nodeName: string
  status: string
  restartCount: number
  ready: string
  containers?: Array<{ name: string }>
  labels: Record<string, string>
  createdAt: string
}

interface Service {
  name: string
  type: string
  clusterIP: string
  ports: string
  createdAt: string
}

interface ReplicaSet {
  name: string
  revision: string
  image: string
  createdAt: string
}


interface ApiResponse<T = any> {
  data?: T
  code: number
  msg?: string
  success: boolean
}

// 响应式数据
const data = ref<Deployment>({} as Deployment)
const pods = ref<Pod[]>([] as Pod[])
const services = ref<Service[]>([] as Service[])
const replicaSets = ref<ReplicaSet[]>([] as ReplicaSet[])
const labelSelector = ref<Record<string, string>>({})
const { getParameter, goToPodTerminal } = useDetailRoutes()

// replicaSets 倒序排序
const sortedReplicaSets = computed(() => {
  return [...replicaSets.value].sort((a, b) => Number(b.revision) - Number(a.revision))
})

const params = reactive({
  id: "",
  namespace: "",
  name: "",
})

// UI 状态
const activeName = ref('Pod') // 默认

const handleClick = (tab: TabsPaneContext) => {
  activeName.value = String(tab.props.name)
  // 获取 Service 数据列表
  if (tab.props.name === 'service') {
    // 如果 labelSelector 为空，则不执行请求
    if (!labelSelector.value || Object.keys(labelSelector.value).length === 0) {
      return
    }
    fetchServices(params.id, params.namespace, labelSelector.value)
  }
  // 获取 ReplicaSet 数据列表
  if (tab.props.name === 'replicaset') {
    // 如果 labelSelector 为空，则不执行请求
    if (!labelSelector.value || Object.keys(labelSelector.value).length === 0) {
      return
    }
    fetchReplicaSets(params.id, params.namespace, labelSelector.value)
  }
}

// API 调用
const fetchDeployment = async (clusterId: string, namespace: string, name: string) => {
  try {
    const response = await getDeploymentDetail(clusterId, namespace, name) as ApiResponse<Deployment>
    if (!response.success) {
      showApiError(response)
    }
    data.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 获取 Pod 列表
 */
const fetchPods = async (clusterId: number, namespace: string, params?: any) => {
  try {
    const response = await getPods(clusterId, namespace, params) as ApiResponse<Pod[]>
    if (!response.success) {
      showApiError(response)
    }
    pods.value = response.data ?? []
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 获取 Service 列表
 */
const fetchServices = async (clusterId: string, namespace: string, params?: any) => {
  try {
    const response = await getServices(clusterId, namespace, params) as ApiResponse<Service[]>
    if (!response.success) {
      showApiError(response)
    }
    services.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 获取 ReplicaSet 列表
 */
const fetchReplicaSets = async (clusterId: string, namespace: string, params?: any) => {
  try {
    const response = await getReplicaSets(clusterId, namespace, params) as ApiResponse<ReplicaSet[]>
    if (!response.success) {
      showApiError(response)
    }
    replicaSets.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 根据 labelSelector 监控变化，获取 Pod 列表
 */
watch(
  () => data.value?.matchLabels,
  async (labels) => {
    if (!labels) return

    const keys = Object.keys(labels)
    if (keys.length === 0) return  // 空标签，不请求

    // 拼接 k=v,k1=v1 格式的 labelSelector
    labelSelector.value = { labelSelector: keys.map(k => `${k}=${labels[k]}`).join(",") }; // 请求参数

    // 调用后端请求 Pod
    try {
      await fetchPods(Number(params.id), params.namespace, labelSelector.value)
    } catch (error) {
      showApiError(error)
    }
  },
  { immediate: true, deep: true }
)

/**
 * 回滚 Deployment 版本
 */
const handleRollout = async(name: string) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要回滚到该版本吗？',
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    const response = await rolloutDeployment(params.id, params.namespace, params.name, {name: name}) as ApiResponse
    if (!response.success) {
      showApiError(`Deployment '${params.name}' 回滚失败. 错误信息: ${response.msg}`)
      return;
    }
    message(`Deployment '${params.name}' 回滚完成！`, {type: "success", duration: 5000});
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error)
    } else {
      message('已取回滚操作!', { type: "info", duration: 5000})
    }
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

const getPodStatusClass = (status?: string) => {
  const normalized = (status || '').trim().toLowerCase()
  if (podErrorStatuses.has(normalized)) return 'pod-status-error'
  if (podSuccessStatuses.has(normalized)) return 'pod-status-success'
  if (podWarningStatuses.has(normalized)) return 'pod-status-warning'
  return ''
}

const goToContainerTerminal = (podName: string, containerName: string) => {
  goToPodTerminal({
    id: params.id,
    ns: params.namespace,
    name: podName,
    container: containerName
  })
}

const handleDeletePod = async (podName: string) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要执行删除操作吗？',
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    const response = await deletePod(Number(params.id), params.namespace, podName) as ApiResponse
    if (!response.success) {
      showApiError(`Pod '${podName}' 删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchPods(Number(params.id), params.namespace, labelSelector.value)
    message(`Pod '${podName}' 删除成功!`, { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error)
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000 })
    }
  }
}

// 生命周期
onMounted(() => {
  Object.assign(params, getParameter)
  fetchDeployment(params.id, params.namespace, params.name)
})
</script>

<template>
  <el-card shadow="never" class="node-detail-card">
    <span class="card-title">Deployment - {{ params.name }}</span>
    <!-- 基本信息 -->
    <el-divider content-position="left">
      <span class="section-title">基本信息</span>
    </el-divider>
    <el-descriptions :column="2" border size="small">
      <el-descriptions-item label="名称">{{ data.name }}</el-descriptions-item>
      <el-descriptions-item label="命名空间">{{ data.namespace }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        就绪：{{ data.readyReplicas }}/{{ data.replicas }} 个 |
        已更新：{{ data.updatedReplicas }} 个 |
        可用：{{ data.availableReplicas }} 个
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ data.createdAt }}</el-descriptions-item>
      <!-- 调度标签 - 单独一行 -->
      <el-descriptions-item label="标签">
        <div class="tags-container">
          <el-tag
            v-for="(value, key) in data.matchLabels"
            :key="key"
            type="info"
            style="margin-right: 4px;"
          >
            {{ key }}{{ value ? `=${value}` : '' }}
          </el-tag>
          <el-button v-if="!data.matchLabels || Object.keys(data.matchLabels).length === 0" text disabled>
            无标签
          </el-button>
        </div>
      </el-descriptions-item>
      <el-descriptions-item label="更新策略">{{ data.strategy?.type }}</el-descriptions-item>
    </el-descriptions>

    <!-- Deployment 更新详情 -->
    <el-divider content-position="left">
      <span class="section-title">更新详情</span>
    </el-divider>
    <el-table :data="data.conditions" style="width: 100%" size="small">
      <el-table-column prop="type" label="类型"></el-table-column>
      <el-table-column prop="status" label="状态"></el-table-column>
      <el-table-column prop="lastTransitionTime" label="更新时间"></el-table-column>
      <el-table-column prop="reason" label="原因"></el-table-column>
      <el-table-column prop="message" label="信息" min-width="270"></el-table-column>
    </el-table>

    <!-- Deployment 服务详情 -->
    <el-divider content-position="left">
    </el-divider>
    <el-tabs
      v-model="activeName"
      type="border-card"
      @tab-click="handleClick"
    >
      <el-tab-pane label="副本集" name="Pod">
        <el-table :data="pods" stripe style="width: 100%" size="small">
          <el-table-column fixed prop="name" label="名称" min-width="150"></el-table-column>
          <el-table-column prop="status" label="运行状态">
            <template #default="scope">
              <span :class="getPodStatusClass(scope.row.status)">
                {{ scope.row.status }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="restartCount" label="重启次数"></el-table-column>
          <el-table-column prop="podIP" label="Pod IP"></el-table-column>
          <el-table-column prop="hostIP" label="节点 IP"></el-table-column>
          <el-table-column prop="createdAt" label="创建时间"></el-table-column>
          <el-table-column fixed="right" label="操作" width="100">
            <template #default="scope">
              <div class="pod-table-actions">
              <el-dropdown v-if="scope.row.containers?.length" placement="bottom">
                <el-button
                  link
                  type="primary"
                  size="small"
                >
                  登录
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="container in scope.row.containers"
                      :key="container.name"
                      @click="goToContainerTerminal(scope.row.name, container.name)"
                    >
                      {{ container.name }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button
                v-else
                link
                type="primary"
                size="small"
                disabled
              >
                登录
              </el-button>
              <el-button link type="primary" size="small" @click="handleDeletePod(scope.row.name)">
                删除
              </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="服务" name="service">
        <el-table :data="services" stripe style="width: 100%" size="small">
          <el-table-column fixed prop="name" label="名称"></el-table-column>
          <el-table-column prop="type" label="类型"></el-table-column>
          <el-table-column prop="clusterIP" label="IP 地址"></el-table-column>
          <el-table-column prop="ports" label="端口"></el-table-column>
          <el-table-column prop="createdAt" label="创建时间"></el-table-column>
          <el-table-column fixed="right" label="操作" width="135">
            <template #default="scope">
              <el-button link type="primary" size="small">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="自动伸缩" name="hpa">
      </el-tab-pane>
      <el-tab-pane label="事件" name="event">
      </el-tab-pane>
      <el-tab-pane label="历史版本" name="replicaset">
        <el-table :data="sortedReplicaSets" stripe style="width: 100%" size="small">
          <el-table-column prop="revision" label="版本" width="70"></el-table-column>
          <el-table-column prop="name" label="名称" min-width="70" show-overflow-tooltip></el-table-column>
          <el-table-column prop="image" label="镜像" min-width="200" show-overflow-tooltip></el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="170"></el-table-column>
          <el-table-column fixed="right" label="操作" width="100">
            <template #default="scope">
              <el-button link type="primary" size="small" @click="handleRollout(scope.row.name)">
                回滚到该版本
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<style scoped lang="scss">
.pod-status-error {
  color: #f56c6c;
}

.pod-status-success {
  color: #67c23a;
}

.pod-status-warning {
  color: #e6a23c;
}

.pod-table-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

:deep(.pod-table-actions .el-button) {
  margin: 0;
  line-height: 1;
}
</style>
