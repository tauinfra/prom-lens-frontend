<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getClusters, getNamespaces, getPods, getPod, deletePod, batchDeletePods } from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { Delete, Refresh } from "@element-plus/icons-vue";
import { ElMessageBox, type CascaderProps } from 'element-plus'
import yaml from 'js-yaml'
import YamlEditor from '@/components/YamlEditor/index.vue'
import { useDetailRoutes } from "@/utils/hooks/useDetailRoute";

const { goToPodTerminal, goToPodDetail } = useDetailRoutes();

defineOptions({
  name: "Pod"
});

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T  // 后端返回错误时，无 data 字段，改为可选属性
  code: number
  msg?: string
  success: boolean
}

// 分页类型
interface Pagination {
  page: number
  size: number
  total: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  keyword: string
}

// 分页参数
const pagination = ref<Pagination>({
  page: 1,
  size: 10, // 每页数量
  total: 0,
  sortBy: 'id', // 可选排序字段
  sortOrder: 'asc', // 排序方式
  keyword: '' // 搜索关键字
})

const data = ref<Record<string, unknown>[]>([])
const clusterId = ref<number>()
const namespace = ref<string>()
const selectedPodNames = ref<string[]>([])
const search = ref('')

const hasValidSelection = computed(() =>
  clusterId.value !== undefined && namespace.value !== undefined
);

const normalizeSearchValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase()
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeSearchValue(item)).join(' ')
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(item => normalizeSearchValue(item))
      .join(' ')
  }
  return ''
}

const filteredData = computed(() => {
  const list = data.value ?? []
  const kw = (search.value || '').trim().toLowerCase()
  if (!kw) return list
  return list.filter(item =>
    Object.keys(item).some(key => normalizeSearchValue(item[key]).includes(kw))
  )
})
const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  return filteredData.value.slice(start, start + pagination.value.size)
})

const props: CascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, data } = node
    try {
      if (level === 0) {
        // 第一级：加载集群列表
        const clusters = await fetchClusters()
        resolve(clusters.map(cluster => ({
          value: cluster.id,
          label: cluster.name,
          leaf: false // 集群下有命名空间
        })))
      } else if (level === 1) {
        // 第二级：加载指定集群的命名空间
        const clusterId = data.value
        const namespaces = await fetchNamespaces(clusterId as number)
        resolve(namespaces.map(ns => ({
          value: ns.name,
          label: ns.name,
          leaf: true // 命名空间是叶子节点
        })))
      } else {
        resolve([])
      }
    } catch (error) {
      showApiError(error)
      resolve([])
    }
  }
}

const handleCascaderChange = async (value: string[]) => {
  if (value && value.length === 2) {
    clusterId.value = parseInt(value[0])
    namespace.value = value[1]
    pagination.value.page = 1
    await fetchPods(clusterId.value, namespace.value)
  } else {
    data.value = []
  }
}

watch(() => search.value, () => { pagination.value.page = 1 })
watch(filteredData, (val) => { pagination.value.total = val.length }, { immediate: true })

/**
 * 获取命名空间列表
 */
const fetchClusters = async () => {
  try {
    const response = await getClusters({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword}) as ApiResponse<[]>
    return response.data || []
  } catch (error) {
    showApiError(error)
    return []
  }
}

/**
 * 获取命名空间列表
 */
const fetchNamespaces = async (clusterId: number) => {
  try {
    const response = await getNamespaces(clusterId) as ApiResponse<[]>
    return response.data || []
  } catch (error) {
    showApiError(error)
    return []
  }
}
/**
 * 获取 Pod 列表
 */
const fetchPods = async (clusterId: number, ns: string) => {
  try {
    const response = await getPods(clusterId, ns) as ApiResponse<[]>
    data.value = response.data ?? []
    selectedPodNames.value = []
  } catch (error) {
    showApiError(error)
    return []
  }
}

/**
 * 获取 Pod YAML 配置
 */
const fetchPod = async (clusterId: number, ns: any, name: string) => {
  try {
    const response = await getPod(clusterId, ns, name) as ApiResponse<[]>
    yamlContent.value = jsonToYaml(response.data)
  } catch (error) {
    showApiError(error)
    return []
  }
}

/**
 * 刷新 Pod 列表
 */
const refreshClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 });
    return
  }
  fetchPods(clusterId.value, namespace.value)
}

/**
 * YAML 配置
 */
const yamlContent = ref()
const DialogVisible = ref(false)

/**
 * JSON 转 YAML
 */
const jsonToYaml = (jsonData: any) => {
  try {
    return yaml.dump(jsonData, {
      indent: 2,
      lineWidth: -1, // 不限制行宽
      noRefs: true,  // 不创建引用
      skipInvalid: true // 跳过无效数据
    })
  } catch (error) {
    console.error('JSON 转 YAML 失败:', error)
    return ''
  }
}

/**
 * yamlClick
 */
const yamlClick = (row: any) => {
  fetchPod(clusterId.value, namespace.value, row.name);
  DialogVisible.value = true
}

const handleDelete = async (name: string) => {
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
    const response = await deletePod(clusterId.value, namespace.value, name) as ApiResponse
    if (!response.success) {
      showApiError(`资源 '${name}' 删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchPods(clusterId.value, namespace.value)
    message('数据删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error.message || error)
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000})
    }
  }
}

const handleSelectionChange = (selection: Array<{ name?: string }>) => {
  selectedPodNames.value = selection.map(item => item.name).filter((name): name is string => !!name)
}

const handleBatchDelete = async () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 })
    return
  }
  if (selectedPodNames.value.length === 0) {
    message('请先选择要删除的 Pod', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedPodNames.value.length} 个 Pod，此操作不可撤销，是否继续？`,
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    const response = await batchDeletePods(clusterId.value, namespace.value, { names: selectedPodNames.value }) as ApiResponse
    if (!response.success) {
      showApiError(`Pod 批量删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchPods(clusterId.value, namespace.value)
    message('批量删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error?.message || error)
    } else {
      message('已取消批量删除操作!', { type: 'info', duration: 5000 })
    }
  }
}

const podErrorStatuses = new Set([
  'ImagePullBackOff',
  'ErrImagePull',
  'CrashLoopBackOff',
  'OOMKilled',
  'Error',
  'CreateContainerConfigError',
  'ContainerCannotRun',
  'Failed'
])

const podSuccessStatuses = new Set([
  'Succeeded',
  'Running',
  'Completed'
])

const podWarningStatuses = new Set([
  'Pending',
  'Waiting',
  'Terminated',
  'Unknown'
])

const isErrorPodStatus = (status: unknown) => {
  if (typeof status !== 'string') return false
  return podErrorStatuses.has(status.trim())
}

const isSuccessPodStatus = (status: unknown) => {
  if (typeof status !== 'string') return false
  return podSuccessStatuses.has(status.trim())
}

const isWarningPodStatus = (status: unknown) => {
  if (typeof status !== 'string') return false
  return podWarningStatuses.has(status.trim())
}

</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="search" placeholder="输入关键字搜索"/>
      </div>
      <el-cascader :props="props" @change="handleCascaderChange" style="min-width: 300px"/>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
      <el-button
        v-show="selectedPodNames.length > 0"
        type="danger"
        plain
        style="margin-left: 5px;"
        @click="handleBatchDelete"
      >
        <el-icon><Delete /></el-icon>
        <span>批量删除</span>
      </el-button>
    </div>

    <el-table :data="pagedData" stripe @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column fixed prop="name" label="Pod 名称" width="400" show-overflow-tooltip></el-table-column>
      <el-table-column prop="ready" label="容器组"></el-table-column>
      <el-table-column prop="status" label="运行状态">
        <template #default="scope">
          <span
            :class="{
              'pod-status-error': isErrorPodStatus(scope.row.status),
              'pod-status-success': isSuccessPodStatus(scope.row.status),
              'pod-status-warning': isWarningPodStatus(scope.row.status)
            }"
          >
            {{ scope.row.status }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="restartCount" label="重启次数"></el-table-column>
      <el-table-column prop="podIP" label="Pod IP"></el-table-column>
      <el-table-column prop="hostIP" label="节点 IP"></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170"></el-table-column>
      <el-table-column fixed="right" label="操作" width="190">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="goToPodDetail(
                    {
                    id: clusterId,
                    namespace: namespace,
                    name: scope.row.name,
                    })">
            详情
          </el-button>
          <el-button link type="primary" size="small" @click="yamlClick(scope.row)">
            YAML
          </el-button>
          <el-dropdown placement="bottom">
            <el-button link type="primary" size="small" style="margin-left: 12px; margin-right: 12px; margin-top: 4px" >
              终端
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="container in scope.row.containers"
                  :key="container.name"
                  @click="goToPodTerminal(
                    {
                    id: clusterId,
                    ns: namespace,
                    name: scope.row.name,
                    container: container.name
                    })"
                >
                  {{ container.name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button link type="primary" size="small" @click="handleDelete(scope.row.name)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 表单分页 -->
    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right;"
    />

    <!-- 表单操作 -->
    <el-dialog title="YAML" v-model="DialogVisible" width="60%">
      <el-form>
        <YamlEditor v-model="yamlContent" style="height: 550px"/>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="DialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="DialogVisible = false">确 认</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
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
</style>
