<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import {
  getClusters,
  getNamespaces,
  getDeployments,
  getDeployment,
  updateDeployment, createDeployment, restartDeployment, scaleDeployment, deleteDeployment, batchDeleteDeployments
} from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { Delete, Plus, Refresh } from "@element-plus/icons-vue";
import { CascaderProps, ElMessageBox} from 'element-plus'
import yaml from 'js-yaml'
import YamlEditor from '@/components/YamlEditor/index.vue'
import { useDetailRoutes } from "@/utils/hooks/useDetailRoute";

const { goToDeploymentDetail } = useDetailRoutes();

defineOptions({
  name: "Deployment"
});

interface Deployment {
  name: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  createdAt: string
}

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

const clusterId = ref<number>();
const namespace = ref<string>();
const name = ref() // deployment name

const data = ref<Deployment[]>([]);
const selectedDeploymentNames = ref<string[]>([])
const yamlContent = ref<string>('');
const dialogVisible = ref<boolean>(false);
const dialogStatus = ref<'create' | 'update'>('create');
const scaleDialogVisible = ref<boolean>(false);
const currentReplicas = ref<number>(0); // 当前副本集数量
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
  const kw = (search.value || '').trim().toLowerCase()
  if (!kw) return data.value
  return data.value.filter((item: Deployment) =>
    Object.values(item).some(value => normalizeSearchValue(value).includes(kw))
  )
})
const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  return filteredData.value.slice(start, start + pagination.value.size)
})

const cascaderProps: CascaderProps = {
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
    await fetchDeployments(clusterId.value, namespace.value)
  } else {
    data.value = []
  }
}

watch(() => search.value, () => { pagination.value.page = 1 })
watch(filteredData, (val) => { pagination.value.total = val.length }, { immediate: true })

/**
 * 获取集群列表
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
 * 获取 Deployment 列表
 */
const fetchDeployments = async (clusterId: number, ns: string) => {
  try {
    const response = await getDeployments(clusterId, ns) as ApiResponse<[]>
    if (!response.success) {
      showApiError(response)
      return
    }
    data.value = response.data ?? []
    selectedDeploymentNames.value = []
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 获取 Deployment YAML 配置
 */
const fetchDeployment = async (clusterId: number, ns: any, name: string) => {
  try {
    const response = await getDeployment(clusterId, ns, name) as ApiResponse<[]>
    yamlContent.value = jsonToYaml(response.data)
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 刷新 Deployment 列表
 */
const refreshClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 });
    return
  }
  fetchDeployments(clusterId.value!, namespace.value!);
}

/**
 * 新增 Deployment（YAML）
 */
const handleCreateClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 });
    return
  }
  dialogStatus.value = 'create'
  name.value = ''
  yamlContent.value = ''
  dialogVisible.value = true
}

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
 * 编辑 YAML
 */
const handleYamlClick = (row: any) => {
  name.value = row.name
  dialogStatus.value = 'update'
  fetchDeployment(clusterId.value, namespace.value, row.name);
  dialogVisible.value = true
}

/**
 * Deployment 创建
 */
const handleCreate = () => {
  return handleSubmit('create');
};

/**
 * Deployment 更新
 */
const handleUpdate = () => {
  return handleSubmit('update');
};

/**
 * Deployment 提交
 */
const handleSubmit = async (operation: 'create' | 'update') => {
  try {
    // 1. 将用户编辑好的 YAML 转 JSON
    const jsonData = yaml.load(yamlContent.value);

    // 2. 根据操作调用后端
    const response = operation === 'create'
      ? await createDeployment(clusterId.value, namespace.value, jsonData) as ApiResponse
      : await updateDeployment(clusterId.value, namespace.value, name.value, jsonData) as ApiResponse;

    if (!response.success) {
      showApiError(`资源 '${name.value}' ${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`)
      return;
    }
    dialogVisible.value = false;
    message(`Deployment '${name.value}' ${operation === 'create' ? '创建' : '更新'}成功！`, {
      type: "success", duration: 5000
    });
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error.message || error)
    } else {
      message(`已取消${operation === 'create' ? '创建' : '更新'}操作!`, { type: "info", duration: 5000})
    }
  }
};

/**
 * Deployment 重启
 */
const handleRestart = async(name: string) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要执行重启操作吗？',
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    const response = await restartDeployment(clusterId.value, namespace.value, name) as ApiResponse

    if (!response.success) {
      showApiError(`资源 '${name}' 重启失败. 错误信息: ${response.msg}`)
      return;
    }
    await fetchDeployments(clusterId.value, namespace.value);
    message(`Deployment '${name}' 重启完成！`, {
      type: "success"
    });
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error.message || error)
    } else {
      message('已取更新操作!', { type: "info", duration: 5000})
    }
  }
};

/**
 * Deployment 伸缩编辑
 */
const handleEditScale = (row: any) => {
  name.value = row.name // 副本集名称
  currentReplicas.value = row.replicas // 当前副本集数量
  dataForm.replicas = row.replicas // 当前副本集数量，需要调整的数量
  scaleDialogVisible.value = true
};

const handleScale = async () => {
  try {
    await ElMessageBox.confirm(
      `此操作不可撤销，确定将 ${name.value} 的副本集数量将调整为 ${dataForm.replicas} 吗？`,
      '提示内容',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customStyle: {
          maxWidth: '40%'
        }
      }
    )
    const response = await scaleDeployment(clusterId.value, namespace.value, name.value, dataForm) as ApiResponse

    if (!response.success) {
      showApiError(`资源 '${name.value}' 更新失败. 错误信息: ${response.msg}`)
      return;
    }
    scaleDialogVisible.value = false;
    message(`资源 '${name.value}' 更新成功！`, {
      type: "success", duration: 5000
    });

  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error.message || error)
    } else {
      message('已取更新操作!', { type: "info", duration: 5000})
    }
  }
};

/**
 * Deployment 删除
 */
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
    const response = await deleteDeployment(clusterId.value, namespace.value, name) as ApiResponse
    if (!response.success) {
      showApiError(`资源 '${name}' 删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchDeployments(clusterId.value, namespace.value)
    message('数据删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error.message || error)
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000})
    }
  }
};

const handleSelectionChange = (selection: Deployment[]) => {
  selectedDeploymentNames.value = selection.map(item => item.name).filter(Boolean)
}

const handleBatchDelete = async () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 })
    return
  }
  if (selectedDeploymentNames.value.length === 0) {
    message('请先选择要删除的 Deployment', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedDeploymentNames.value.length} 个 Deployment，此操作不可撤销，确定要执行删除操作吗？`,
      '提示内容',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await batchDeleteDeployments(clusterId.value!, namespace.value!, { names: selectedDeploymentNames.value }) as ApiResponse
    if (!response.success) {
      showApiError(`Deployment 批量删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchDeployments(clusterId.value!, namespace.value!)
    message('批量删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error)
    } else {
      message('已取消批量删除操作!', { type: "info", duration: 5000 })
    }
  }
}

const dataForm = reactive({
  replicas: undefined,
})

</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="search" placeholder="输入关键字搜索"/>
      </div>
      <el-cascader :props="cascaderProps" @change="handleCascaderChange" placeholder="选择集群 / 命名空间" style="min-width: 300px"/>
      <el-button type="primary" plain style="margin-left: 5px;" @click="handleCreateClick">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
      <el-button
        v-show="selectedDeploymentNames.length > 0"
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
      <el-table-column fixed prop="name" label="名称" show-overflow-tooltip></el-table-column>
      <el-table-column prop="replicas" label="副本集(就绪/期望)" width="160">
        <template #default="{ row }">
          {{ row.readyReplicas || 0 }}/{{ row.replicas || 0 }}
        </template>
      </el-table-column>
      <el-table-column prop="updatedReplicas" label="更新副本集" width="140"></el-table-column>
      <el-table-column prop="availableReplicas" label="可用副本集" width="140"></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170"></el-table-column>
      <el-table-column fixed="right" label="操作" width="320">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="goToDeploymentDetail(
                    {
                    id: clusterId,
                    namespace: namespace,
                    name: scope.row.name,
                    })">
            详情
          </el-button>
          <el-button link type="primary" size="small" @click="handleRestart(scope.row.name)">
            重新部署
          </el-button>
          <el-button link type="primary" size="small" @click="handleEditScale(scope.row)">
            调整副本数
          </el-button>
          <el-button link type="primary" size="small" @click="handleYamlClick(scope.row)">
            编辑 YAML
          </el-button>
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

    <!-- YAML 更新操作 -->
    <el-dialog title="YAML" v-model="dialogVisible" width="60%">
      <el-form>
        <YamlEditor v-model="yamlContent" style="height: 550px"/>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="dialogStatus==='create'?handleCreate():handleUpdate()">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 更新副本集 -->
    <el-dialog title="伸缩副本集" v-model="scaleDialogVisible" width="40%">
      <el-form>
        <el-form-item label="副本集数量：" prop="replicas" label-width="110px">
          <el-input-number
            v-model="dataForm.replicas"
            :min="0"
            :max="100"
            controls-position="right"
            style="width: 70%;"
          />
        </el-form-item>
        <div class="replica-hint" style="display: block; margin-top: 4px; margin-left: 15px; font-size: 14px;">
          更新资源 <strong>{{ name }}</strong> 的副本集数量；
          已创建 <strong>{{ currentReplicas }}</strong> 个，
          总共需要 <strong>{{ dataForm.replicas }}</strong> 个
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="scaleDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleScale()">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
</style>
