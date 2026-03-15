<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getStatefulSetDetail, getPods, getServices } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { useDetailRoutes } from "@/utils/hooks/useDetailRoute";
import { TabsPaneContext } from 'element-plus';
import "codemirror/theme/dracula.css";

defineOptions({
  name: "StatefulSetDetail"
});

interface StatefulSet {
  namespace: string
  name: string
  matchLabels: Record<string, string>
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  strategy: Record<string, string>
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
const data = ref<StatefulSet>({} as StatefulSet)
const pods = ref<Pod[]>([] as Pod[])
const services = ref<Service[]>([] as Service[])
const labelSelector = ref<Record<string, string>>({})
const { getParameter } = useDetailRoutes()

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
}

// API 调用
const fetchStatefulSet = async (clusterId: string, namespace: string, name: string) => {
  try {
    const response = await getStatefulSetDetail(clusterId, namespace, name) as ApiResponse<StatefulSet>
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
const fetchPods = async (clusterId: string, namespace: string, params?: any) => {
  try {
    const response = await getPods(clusterId, namespace, params) as ApiResponse<Pod[]>
    if (!response.success) {
      showApiError(response)
    }
    pods.value = response.data
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
      await fetchPods(params.id, params.namespace, labelSelector.value)
    } catch (error) {
      showApiError(error)
    }
  },
  { immediate: true, deep: true }
)

// 生命周期
onMounted(() => {
  Object.assign(params, getParameter)
  fetchStatefulSet(params.id, params.namespace, params.name)
})
</script>

<template>
  <el-card shadow="never" class="node-detail-card">
    <span class="card-title">StatefulSet - {{ params.name }}</span>
    <!-- 基本信息 -->
    <el-divider content-position="left">
      <span class="section-title">基本信息</span>
    </el-divider>
    <el-descriptions :column="2" border size="small">
      <el-descriptions-item label="名称">{{ data.name }}</el-descriptions-item>
      <el-descriptions-item label="命名空间">{{ data.namespace }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        就绪：{{ data.readyReplicas || 0 }}/{{ data.replicas || 0 }} 个 |
        已更新：{{ data.updatedReplicas  || 0  }} 个 |
        可用：{{ data.availableReplicas  || 0  }} 个
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

    <!-- StatefulSet 服务详情 -->
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
          <el-table-column prop="status" label="运行状态"></el-table-column>
          <el-table-column prop="restartCount" label="重启次数"></el-table-column>
          <el-table-column prop="podIP" label="Pod IP"></el-table-column>
          <el-table-column prop="hostIP" label="节点 IP"></el-table-column>
          <el-table-column prop="createdAt" label="创建时间"></el-table-column>
          <el-table-column fixed="right" label="操作" width="90">
            <template #default="scope">
              <el-button link type="primary" size="small">
                终端
              </el-button>
              <el-button link type="primary" size="small">
                删除
              </el-button>
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
    </el-tabs>
  </el-card>
</template>

<style scoped lang="scss">
</style>
