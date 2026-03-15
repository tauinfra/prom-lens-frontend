<script setup lang="ts">
import { ref, reactive, onMounted, watch, onUnmounted } from 'vue'
import {getPodDetail, getEvents, getLogs} from '@/api/kubernetes'
import { showApiError } from "@/utils/message";
import { useDetailRoutes } from "@/utils/hooks/useDetailRoute";
import { formatDate } from "@/utils/date";
import type { TabsPaneContext } from 'element-plus';
import { getToken } from "@/utils/auth";
import "codemirror/theme/dracula.css";
import Codemirror from "codemirror-editor-vue3";

defineOptions({
  name: "PodDetail"
});

// 类型定义
interface Container {
  name: string
  image: string
  status: 'running' | 'waiting' | 'terminated' | 'unknown'
  ready: boolean
  restartCount: number
  startedAt?: string
  createdAt?: string
  imageID?: string
  containerID?: string
}

interface PodCondition {
  type: string
  status: string
  lastTransitionTime: string
  lastProbeTime: string
  reason?: string
  message?: string
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
  containers: Container[]
  conditions: PodCondition[]
  labels: Record<string, string>
  createdAt: string
}

interface Event {
  type: string
  reason: string
  object: string
  source: string
  createAt: string
}

interface ApiResponse<T = any> {
  data?: T
  code: number
  msg?: string
  success: boolean
}

// 响应式数据
const data = ref<Pod>({} as Pod)
const events = ref<Event[]>([])
const { getParameter, goToPodTerminal } = useDetailRoutes()

const params = reactive({
  id: "",
  namespace: "",
  name: "",
})

// UI 状态
const activeName = ref('pod')
const container = ref('')
const follow = ref(false)
const tailLines = ref(100)
const linesOptions = [100, 200, 500]

// 日志相关
const ws = ref<WebSocket | null>(null)
const innerCode = ref('')
const codemirror = ref(null)
const cmOptions = {
  mode: "log",
  theme: "dracula",
  lineNumbers: true,
  readOnly: true
}

// Token
const tokenInfo = getToken()
const token = tokenInfo?.accessToken || ""

// 方法
const getPodStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    'Running': 'success',
    'Pending': 'warning',
    'Failed': 'danger',
    'Succeeded': 'info',
    'Unknown': 'info',
    'Completed': 'success'
  }
  return typeMap[status] || 'info'
}

const handleClick = (tab: TabsPaneContext) => {
  activeName.value = String(tab.props.name)

  const { id, namespace, name } = getParameter as { id: string, namespace: string; name: string }

  if (tab.props.name === 'event') {
    fetchEventData(id, namespace, { kind: 'Pod', name })
  }

  if (tab.props.name === 'log') {
    fetchLogData(id, namespace, name, container.value, {
      follow: follow.value ? 'true' : 'false',
      tailLines: tailLines.value.toString()
    })
  }
}

// API 调用
const fetchData = async (clusterId: string, namespace: string, name: string) => {
  try {
    const response = await getPodDetail(clusterId, namespace, name) as ApiResponse<Pod>
    data.value = response.data
    const firstContainer = response.data?.containers?.[0]
    if (firstContainer?.name) {
      container.value = firstContainer.name
    }
  } catch (error) {
    showApiError(error)
  }
}

const fetchEventData = async (clusterId: string, namespace: string, params?: Record<string, string>) => {
  try {
    const response = await getEvents(clusterId, namespace, params) as ApiResponse<Event[]>
    events.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

const fetchLogData = async (clusterId: string, namespace: string, name: string, container: string, params?: Record<string, string>) => {
  try {
    const response = await getLogs(clusterId, namespace, name, container, params) as ApiResponse<any>
    innerCode.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

const handleLogin = (containerName: string) => {
  goToPodTerminal({
    id: params.id,
    ns: params.namespace,
    name: params.name,
    container: containerName
  })
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const formatted = formatDate(value)
  return formatted === 'Invalid Date' ? '-' : formatted
}

const getContainerStartTime = (container: Container) => {
  return formatDateTime(container.startedAt || container.createdAt)
}

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

// 关闭 WebSocket 连接
const closeWebSocket = () => {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
}

// 监听 follow 变化
watch(follow, (newVal) => {
  if (newVal) {
    // 开启 WebSocket
    const url = `ws://127.0.0.1:8080/api/v1/kubernetes/clusters/${params.id}/namespaces/${params.namespace}/pods/${params.name}/containers/${container.value}/logs?follow=true&tailLines=${tailLines.value}`
    ws.value = new WebSocket(url, [token])
    ws.value.onopen = () => {}
    ws.value.onmessage = (event) => innerCode.value += event.data.toString()
    ws.value.onerror = () => {}
    ws.value.onclose = () => {
      ws.value = null
    }
  } else {
    // 关闭 WebSocket
    closeWebSocket()
  }
})

// 监听 activeName 变化，离开 log 标签页时关闭 WebSocket
watch(activeName, (newVal) => {
  if (newVal !== 'log') {
    closeWebSocket()
    // 可选：离开 log 标签页时关闭 follow
    follow.value = false
  }
})

// 生命周期
onMounted(() => {
  Object.assign(params, getParameter)
  fetchData(params.id, params.namespace, params.name)
})

// 组件卸载时关闭 WebSocket
onUnmounted(() => {
  closeWebSocket()
})
</script>

<template>
  <el-card shadow="never" class="node-detail-card">
    <span class="card-title">Pod - {{ data.name }}</span>
    <!-- 基本信息 -->
    <el-divider content-position="left">
      <span class="section-title">基本信息</span>
    </el-divider>
    <el-descriptions class="pod-basic-info" :column="2" :label-width="120" border size="small">
      <el-descriptions-item label="Pod 名称">{{ data.name }}</el-descriptions-item>
      <el-descriptions-item label="命名空间">{{ data.namespace }}</el-descriptions-item>
      <el-descriptions-item label="Pod 状态">
        <template #default="scope">
          <el-tag :type="getPodStatusType(data.status)">
            {{ data.status }}
          </el-tag>
        </template>
      </el-descriptions-item>
      <el-descriptions-item label="Pod 节点">{{ data.hostIP }}</el-descriptions-item>
      <el-descriptions-item label="Pod 地址">{{ data.podIP }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ data.createdAt }}</el-descriptions-item>
      <!-- Pof 标签 - 单独一行 -->
      <el-descriptions-item label="Pod 标签" :span="2">
        <div class="tags-container">
          <el-tag
            v-for="(value, key) in data.labels"
            :key="key"
            type="info"
            style="margin-right: 4px;"
          >
            {{ key }}{{ value ? `=${value}` : '' }}
          </el-tag>
          <el-button v-if="!data.labels || Object.keys(data.labels).length === 0" text disabled>
            无标签
          </el-button>
        </div>
      </el-descriptions-item>
    </el-descriptions>

    <!-- Pod 状态 -->
    <el-divider content-position="left">
      <span class="section-title">Pod 状态</span>
    </el-divider>
    <el-table :data="data.conditions" style="width: 100%" size="small">
      <el-table-column fixed prop="type" label="类型"></el-table-column>
      <el-table-column prop="status" label="状态"></el-table-column>
      <el-table-column label="更新时间" min-width="180">
        <template #default="scope">
          {{ formatDateTime(scope.row.lastTransitionTime) }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因"></el-table-column>
      <el-table-column prop="message" label="信息"></el-table-column>
    </el-table>

    <!-- Pod 列表 -->
    <el-divider content-position="left">
      <span class="section-title">Pod 信息</span>
    </el-divider>
    <el-tabs
      v-model="activeName"
      type="border-card"
      @tab-click="handleClick"
    >
      <el-tab-pane label="容器" name="pod">
        <el-table :data="data.containers || []" style="width: 100%" size="small">
          <el-table-column fixed prop="name" label="容器名称"></el-table-column>
          <el-table-column prop="image" label="镜像"></el-table-column>
          <el-table-column prop="state" label="运行状态">
            <template #default="scope">
              <span :class="getPodStatusClass(scope.row.state)">
                {{ scope.row.state || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="restartCount" label="重启次数" width="100"></el-table-column>
          <el-table-column label="启动时间" min-width="180">
            <template #default="scope">
              {{ getContainerStartTime(scope.row) }}
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="100">
            <template #default="scope">
              <el-button link type="primary" size="small" @click="handleLogin(scope.row.name)">
                登录
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="事件" name="event">
        <el-table :data="events" style="width: 100%" size="small">
          <el-table-column fixed prop="type" label="类型" width="120"></el-table-column>
          <el-table-column fixed prop="reason" label="原因" width="120"></el-table-column>
          <el-table-column fixed prop="object" label="对象"></el-table-column>
          <el-table-column fixed prop="message" label="信息"></el-table-column>
          <el-table-column fixed prop="createAt" label="时间"></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="日志" name="log">
        <div class="flex flex-wrap gap-4 items-center">
          <el-select
            v-model="container"
            size="small"
            placeholder="请选择容器"
            style="width: 240px"
          >
            <el-option
              v-for="item in data.containers"
              :key="item.name"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
          <el-select
            v-model="tailLines"
            placeholder="请选择行数"
            size="small"
            style="width: 240px"
          >
            <el-option
              v-for="(item, index) in linesOptions"
              :key="index"
              :label="item"
              :value="item"
            />
          </el-select>
          <el-switch
            v-model="follow"
            class="mb-2"
            active-text="自动刷新"
          />
          <el-button size="small">刷新</el-button>
        </div>
        <Codemirror
          ref="codemirror"
          v-model:value="innerCode"
          :options="cmOptions"
          border
          :height="400"
        />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<style scoped lang="scss">
:deep(.pod-basic-info .el-descriptions__label) {
  white-space: nowrap;
}

.pod-status-error {
  color: #f56c6c;
}

.pod-status-success {
  color: #67c23a;
}

.pod-status-warning {
  color: #e6a23c;
}
</style>
