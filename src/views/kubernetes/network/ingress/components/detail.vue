<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getIngressDetail } from '@/api/kubernetes'
import { showApiError } from '@/utils/message'
import { useDetailRoutes } from '@/utils/hooks/useDetailRoute'
import { formatDate } from '@/utils/date'

defineOptions({
  name: 'IngressDetail'
})

interface ApiResponse<T = any> {
  data?: T
  code: number
  msg?: string
  success: boolean
}

interface IngressDetail {
  name?: string
  namespace?: string
  className?: string
  endpoint?: string
  paths?: number
  createdAt?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  metadata?: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  rules?: Array<{
    host?: string
    path?: string
    pathType?: string
    serviceName?: string
    servicePort?: string | number
    backendService?: string
    backendPort?: string | number
  }>
  spec?: {
    ingressClassName?: string
    tls?: Array<{ hosts?: string[] }>
    rules?: Array<{
      host?: string
      http?: {
        paths?: Array<{
          path?: string
          pathType?: string
          backend?: {
            service?: {
              name?: string
              port?: { number?: number; name?: string }
            }
          }
        }>
      }
    }>
  }
}

const data = ref<IngressDetail>({})
const { getParameter } = useDetailRoutes()

const params = reactive({
  id: '',
  namespace: '',
  name: ''
})

const rulesRows = computed(() => {
  const rows: Array<{
    host: string
    path: string
    pathType: string
    serviceName: string
    servicePort: string
  }> = []
  // 优先使用后端 detail 直接返回的 rules
  if (Array.isArray(data.value.rules) && data.value.rules.length > 0) {
    data.value.rules.forEach((rule: any) => {
      const host = rule.host || '-'
      const rulePaths = Array.isArray(rule.paths) ? rule.paths : []

      if (rulePaths.length > 0) {
        rulePaths.forEach((item: any) => {
          const backendService = item?.backend?.service
          const serviceName = item?.service || item?.serviceName || item?.backendService || backendService?.name
          const servicePortRaw = item?.port ?? item?.servicePort ?? item?.backendPort ?? backendService?.port?.number ?? backendService?.port?.name
          rows.push({
            host,
            path: item?.path || '-',
            pathType: item?.pathType || '-',
            serviceName: serviceName || '-',
            servicePort: servicePortRaw !== undefined ? String(servicePortRaw) : '-'
          })
        })
        return
      }

      // 兼容老结构（没有 paths，字段平铺在 rule 上）
      rows.push({
        host,
        path: rule.path || '-',
        pathType: rule.pathType || '-',
        serviceName: rule.serviceName || rule.backendService || '-',
        servicePort: rule.servicePort !== undefined
          ? String(rule.servicePort)
          : rule.backendPort !== undefined
            ? String(rule.backendPort)
            : '-'
      })
    })
    return rows
  }

  // 兜底兼容 spec.rules 结构
  const rules = data.value.spec?.rules || []
  rules.forEach(rule => {
    const host = rule.host || '-'
    const paths = rule.http?.paths || []
    if (paths.length === 0) {
      rows.push({
        host,
        path: '-',
        pathType: '-',
        serviceName: '-',
        servicePort: '-'
      })
      return
    }
    paths.forEach(item => {
      const backend = item.backend?.service
      const port = backend?.port?.number ?? backend?.port?.name
      rows.push({
        host,
        path: item.path || '-',
        pathType: item.pathType || '-',
        serviceName: backend?.name || '-',
        servicePort: port !== undefined ? String(port) : '-'
      })
    })
  })
  return rows
})

const classNameText = computed(() => data.value.className || data.value.spec?.ingressClassName || '-')
const labelEntries = computed(() => Object.entries(data.value.labels || data.value.metadata?.labels || {}))
const annotationEntries = computed(() => Object.entries(data.value.annotations || data.value.metadata?.annotations || {}))

const fetchDetail = async (id: string, namespace: string, name: string) => {
  try {
    const response = await getIngressDetail(id, namespace, name) as ApiResponse<IngressDetail>
    if (!response.success) {
      showApiError(response)
      return
    }
    data.value = response.data ?? {}
  } catch (error) {
    showApiError(error)
  }
}

onMounted(() => {
  Object.assign(params, getParameter)
  fetchDetail(params.id, params.namespace, params.name)
})
</script>

<template>
  <el-card shadow="never" class="detail-card">
    <span class="card-title">Ingress - {{ params.name }}</span>
    <el-divider content-position="left">
      <span class="section-title">基本信息</span>
    </el-divider>
    <el-descriptions :column="2" border size="small" :label-width="110">
      <el-descriptions-item label="名称">{{ data.name || params.name }}</el-descriptions-item>
      <el-descriptions-item label="命名空间">{{ data.namespace || params.namespace }}</el-descriptions-item>
      <el-descriptions-item label="端点">{{ data.endpoint || '-' }}</el-descriptions-item>
      <el-descriptions-item label="网关类型" label-class-name="ingress-class-label">
        <span class="nowrap-text">{{ classNameText }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="标签">
        <div v-if="labelEntries.length > 0" class="kv-wrap">
          <el-tag
            v-for="([key, value]) in labelEntries"
            :key="`label-${key}`"
            type="info"
            size="small"
            class="kv-tag"
          >
            {{ key }}={{ value }}
          </el-tag>
        </div>
        <span v-else>-</span>
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">
        {{ data.createdAt ? formatDate(data.createdAt) : '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="注释" :span="2">
        <div v-if="annotationEntries.length > 0" class="kv-wrap">
          <el-tag
            v-for="([key, value]) in annotationEntries"
            :key="`anno-${key}`"
            type="info"
            size="small"
            class="kv-tag"
          >
            {{ key }}={{ value }}
          </el-tag>
        </div>
        <span v-else>-</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">
      <span class="section-title">路由规则</span>
    </el-divider>
    <el-table :data="rulesRows" stripe>
      <el-table-column prop="host" label="域名"/>
      <el-table-column prop="pathType" label="路径类型"/>
      <el-table-column prop="path" label="路径"/>
      <el-table-column prop="serviceName" label="服务名称"/>
      <el-table-column prop="servicePort" label="服务端口"/>
    </el-table>
  </el-card>
</template>

<style scoped lang="scss">
.kv-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kv-tag {
  max-width: 100%;
}

:deep(.el-descriptions__label) {
  white-space: nowrap;
}

.nowrap-text {
  white-space: nowrap;
}
</style>
