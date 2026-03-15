<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  getClusters,
  getNamespaces,
  getKubeRoles,
  getKubeRole,
  updateKubeRole,
  createKubeRole,
  deleteKubeRole,
  batchDeleteKubeRoles
} from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { Delete, Plus, Refresh } from "@element-plus/icons-vue";
import { CascaderProps, ElMessageBox } from 'element-plus'
import yaml from 'js-yaml'
import YamlEditor from '@/components/YamlEditor/index.vue'

defineOptions({
  name: "IamRole"
});

interface Role {
  name: string
  createdAt?: string
}

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T
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
  size: 10,
  total: 0,
  sortBy: 'id',
  sortOrder: 'asc',
  keyword: ''
})

const clusterId = ref<number>();
const namespace = ref<string>();
const name = ref<string>('');

const data = ref<Role[]>([]);
const selectedRoleNames = ref<string[]>([])
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

// 前端分页：按关键字过滤后截取当前页
const filteredData = computed(() => {
  const kw = (pagination.value.keyword || '').trim().toLowerCase()
  if (!kw) return data.value
  return data.value.filter(item =>
    Object.keys(item).some(key =>
      normalizeSearchValue((item as Record<string, unknown>)[key]).includes(kw)
    )
  )
})
const pagedData = computed(() => {
  const { page, size } = pagination.value
  const start = (page - 1) * size
  return filteredData.value.slice(start, start + size)
})

const cascaderProps: CascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, data: nodeData } = node
    try {
      if (level === 0) {
        const clusters = await fetchClusters()
        resolve(clusters.map((c: { id: number; name: string }) => ({
          value: c.id,
          label: c.name,
          leaf: false
        })))
      } else if (level === 1) {
        const cid = nodeData.value
        const namespaces = await fetchNamespaces(cid as number)
        resolve(namespaces.map((ns: { name: string }) => ({
          value: ns.name,
          label: ns.name,
          leaf: true
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
    await fetchRoles(clusterId.value, namespace.value)
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

const fetchClusters = async () => {
  try {
    const response = await getClusters({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword
    }) as ApiResponse<Array<{ id: number; name: string }>>
    return response.data || []
  } catch (error) {
    showApiError(error)
    return []
  }
}

const fetchNamespaces = async (cid: number) => {
  try {
    const response = await getNamespaces(cid) as ApiResponse<Array<{ name: string }>>
    return response.data || []
  } catch (error) {
    showApiError(error)
    return []
  }
}

const fetchRoles = async (cid: number, ns: string) => {
  try {
    const response = await getKubeRoles(cid, ns) as ApiResponse<Role[]>
    data.value = response.data ?? []
  } catch (error) {
    showApiError(error)
    data.value = []
  }
}

const fetchRole = async (cid: number, ns: string, roleName: string) => {
  try {
    const response = await getKubeRole(cid, ns, roleName) as ApiResponse<unknown>
    yamlContent.value = jsonToYaml(response.data)
  } catch (error) {
    showApiError(error)
  }
}

const refreshClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 });
    return
  }
  fetchRoles(clusterId.value!, namespace.value!)
}

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

const jsonToYaml = (jsonData: unknown) => {
  try {
    return yaml.dump(jsonData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      skipInvalid: true
    })
  } catch (error) {
    console.error('JSON 转 YAML 失败:', error)
    return ''
  }
}

const handleYamlClick = (row: Role) => {
  name.value = row.name
  dialogStatus.value = 'update'
  fetchRole(clusterId.value!, namespace.value!, row.name)
  dialogVisible.value = true
}

const handleCreate = () => handleSubmit('create')
const handleUpdate = () => handleSubmit('update')

const handleSubmit = async (operation: 'create' | 'update') => {
  try {
    const jsonData = yaml.load(yamlContent.value)
    if (operation === 'create' && !name.value) {
      name.value = (jsonData as { metadata?: { name?: string } })?.metadata?.name ?? ''
    }

    const response = operation === 'create'
      ? await createKubeRole(clusterId.value!, namespace.value!, name.value, jsonData) as ApiResponse
      : await updateKubeRole(clusterId.value!, namespace.value!, name.value, jsonData) as ApiResponse

    if (!response.success) {
      showApiError(`Role '${name.value}' ${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`)
      return
    }
    dialogVisible.value = false
    message(`Role '${name.value}' ${operation === 'create' ? '创建' : '更新'}成功！`, { type: "success", duration: 5000 })
    await fetchRoles(clusterId.value!, namespace.value!)
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error instanceof Error ? error.message : error)
    } else {
      message(`已取消${operation === 'create' ? '创建' : '更新'}操作!`, { type: "info", duration: 5000 })
    }
  }
}

const handleDelete = async (roleName: string) => {
  try {
    await ElMessageBox.confirm(
      '此操作不可撤销，确定要执行删除操作吗？',
      '提示内容',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await deleteKubeRole(clusterId.value!, namespace.value!, roleName) as ApiResponse
    if (!response.success) {
      showApiError(`Role '${roleName}' 删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchRoles(clusterId.value!, namespace.value!)
    message('删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error instanceof Error ? error.message : error)
    } else {
      message('已取消删除操作!', { type: "info", duration: 5000 })
    }
  }
}

const handleSelectionChange = (selection: Role[]) => {
  selectedRoleNames.value = selection.map(item => item.name).filter(Boolean)
}

const handleBatchDelete = async () => {
  if (!hasValidSelection.value) {
    message('请先选择集群和命名空间', { type: 'warning', duration: 5000 })
    return
  }
  if (selectedRoleNames.value.length === 0) {
    message('请先选择要删除的 Role', { type: 'warning', duration: 5000 })
    return
  }
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedRoleNames.value.length} 个 Role，此操作不可撤销，确定要执行删除操作吗？`,
      '提示内容',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await batchDeleteKubeRoles(clusterId.value!, namespace.value!, { names: selectedRoleNames.value }) as ApiResponse
    if (!response.success) {
      showApiError(`Role 批量删除失败. 错误信息: ${response.msg}`)
      return
    }
    await fetchRoles(clusterId.value!, namespace.value!)
    message('批量删除成功!', { type: "success", duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') {
      showApiError(error instanceof Error ? error.message : error)
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
        v-show="selectedRoleNames.length > 0"
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
      <el-table-column fixed prop="name" label="名称"/>
      <el-table-column prop="createdAt" label="创建时间"/>
      <el-table-column fixed="right" label="操作" width="175">
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
      style="float: right;"
    />

    <el-dialog title="Role YAML" v-model="dialogVisible" width="60%">
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
