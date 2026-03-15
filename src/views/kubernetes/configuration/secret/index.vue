<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  getClusters,
  getNamespaces,
  getSecrets,
  getSecret,
  updateSecret, createSecret, deleteSecret, batchDeleteSecrets
} from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { Delete, Plus, Refresh } from "@element-plus/icons-vue";
import { CascaderProps, ElMessageBox} from 'element-plus'
import yaml from 'js-yaml'
import YamlEditor from '@/components/YamlEditor/index.vue'

defineOptions({
  name: "Secret"
});

interface Secret {
  name: string
  type: string
  /** 数据条数或 data 对象（K8s 为 key 数量或 data 键值对） */
  data?: number | Record<string, string>
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
const name = ref() // Secret name

const data = ref<Secret[]>([]);
const selectedSecretNames = ref<string[]>([])
const yamlContent = ref<string>('');
const dialogVisible = ref<boolean>(false);
const dialogStatus = ref<'create' | 'update'>('create');

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
  const kw = (pagination.value.keyword || '').trim().toLowerCase()
  if (!kw) return data.value
  return data.value.filter((item: Secret) =>
    Object.keys(item).some(key =>
      normalizeSearchValue((item as Record<string, unknown>)[key]).includes(kw)
    )
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
    await fetchSecrets(clusterId.value, namespace.value)
  } else {
    data.value = []
  }
}

watch(
  () => pagination.value.keyword,
  () => {
    pagination.value.page = 1
  }
)
watch(filteredData, (val) => {
  pagination.value.total = val.length
}, { immediate: true })

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
 * 获取 Secret 列表
 */
const fetchSecrets = async (clusterId: number, ns: string) => {
  try {
    const response = await getSecrets(clusterId, ns) as ApiResponse<Secret[]>
    data.value = response.data ?? []
  } catch (error) {
    showApiError(error)
    data.value = []
  }
}

/**
 * 获取 Secret YAML 配置
 */
const fetchSecret = async (clusterId: number, ns: any, name: string) => {
  try {
    const response = await getSecret(clusterId, ns, name) as ApiResponse<unknown>
    yamlContent.value = jsonToYaml(response.data ?? {})
  } catch (error) {
    showApiError(error)
  }
}

/**
 * 刷新 Secret 列表
 */
const refreshClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 });
    return
  }
  fetchSecrets(clusterId.value, namespace.value)
}

/**
 * 新增 Secret（YAML）
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
  fetchSecret(clusterId.value, namespace.value, row.name);
  dialogVisible.value = true
}

/**
 * Secret 创建
 */
const handleCreate = () => {
  return handleSubmit('create');
};

/**
 * Secret 更新
 */
const handleUpdate = () => {
  return handleSubmit('update');
};

/**
 * Secret 提交
 */
const handleSubmit = async (operation: 'create' | 'update') => {
  try {
    // 1. 将用户编辑好的 YAML 转 JSON
    const jsonData = yaml.load(yamlContent.value);
    if (operation === 'create' && !name.value) {
      name.value = (jsonData as any)?.metadata?.name
    }

    // 2. 根据操作调用后端
    const response = operation === 'create'
      ? await createSecret(clusterId.value, namespace.value, name.value, jsonData) as ApiResponse
      : await updateSecret(clusterId.value, namespace.value, name.value, jsonData) as ApiResponse;

    if (!response.success) {
      showApiError(`资源 '${name.value}' ${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`)
      return;
    }
    dialogVisible.value = false;
    message(`Secret '${name.value}' ${operation === 'create' ? '创建' : '更新'}成功！`, {
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
 * Secret 删除
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
    const response = await deleteSecret(clusterId.value, namespace.value, name) as ApiResponse
    if (!response.success) {
      showApiError(`资源 '${name}' 删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchSecrets(clusterId.value, namespace.value)
    message('数据删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error.message || error)
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000})
    }
  }
};

const handleSelectionChange = (selection: Secret[]) => {
  selectedSecretNames.value = selection.map(item => item.name).filter(Boolean)
}

const handleBatchDelete = async () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 })
    return
  }
  if (selectedSecretNames.value.length === 0) {
    message('请先选择要删除的 Secret', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedSecretNames.value.length} 个 Secret，此操作不可撤销，确定要执行删除操作吗？`,
      '提示内容',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await batchDeleteSecrets(clusterId.value!, namespace.value!, { names: selectedSecretNames.value }) as ApiResponse
    if (!response.success) {
      showApiError(`Secret 批量删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchSecrets(clusterId.value!, namespace.value!)
    message('批量删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error)
    } else {
      message('已取消批量删除操作!', { type: "info", duration: 5000 })
    }
  }
}

</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
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
        v-show="selectedSecretNames.length > 0"
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
      <el-table-column fixed prop="name" label="名称" />
      <el-table-column prop="type" label="类型" />
      <el-table-column label="数据条数" width="140">
        <template #default="{ row }">
          {{ row.data == null ? '-' : typeof row.data === 'number' ? row.data : Object.keys(row.data).length }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column fixed="right" label="操作" width="135">
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
  </div>
</template>

<style scoped lang="scss">
</style>
