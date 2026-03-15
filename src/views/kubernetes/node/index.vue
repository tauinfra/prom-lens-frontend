<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getClusters, getNodes, updateNodeCordon, updateNodeLabels, updateNodeTaints} from '@/api/kubernetes'
import { message, showApiError } from "@/utils/message";
import { Refresh, Delete, Plus } from "@element-plus/icons-vue";
import { ElMessageBox } from 'element-plus'
import type { DrawerProps } from 'element-plus'
import { Check, Close } from '@element-plus/icons-vue'

import { useNodeDetails  } from "./components/hooks";

defineOptions({
  name: "Node"
});

// 类型定义
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

interface Cluster {
  id: number;
  name: string;
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

const { goToNodeDetails } = useNodeDetails();

const data = ref<Node[]>([])

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
  return data.value.filter((item: Node) =>
    Object.keys(item).some(key =>
      normalizeSearchValue((item as Record<string, unknown>)[key]).includes(kw)
    )
  )
})
const pagedData = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  return filteredData.value.slice(start, start + pagination.value.size)
})

watch(() => pagination.value.keyword, () => { pagination.value.page = 1 })
watch(filteredData, (val) => { pagination.value.total = val.length }, { immediate: true })

const clusterID = ref<number>()
const clusterOptions = ref<Cluster[]>([])

// 集群下拉框数据
const clusterData = async () => {
  try {
    const response = await getClusters({
      page: pagination.value.page,
      size: pagination.value.size,
      sortBy: pagination.value.sortBy,
      sortOrder: pagination.value.sortOrder,
      keyword: pagination.value.keyword,}) as ApiResponse<Cluster[]>
    clusterOptions.value = response.data
  } catch (error) {
    showApiError(error)
  }
}

// 获取表单数据
const tableData = async () => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  try {
    const response = await getNodes(clusterID.value) as ApiResponse<Node[]>
    data.value = response.data || []
  } catch (error) {
    showApiError(error)
  }
}


// 生命周期钩子
onMounted(() => {
  clusterData()
})

const selectChange = () => {
  pagination.value.page = 1
  tableData()
}

// 刷新
const refreshClick = () => {
  tableData()
}

// 标签管理
const directionLabels = ref<DrawerProps['direction']>()
const drawerLabels = ref(false)
const nodeName = ref()
const labelTags = ref([])
const manageLabels = (row:  Node) => {
  drawerLabels.value = true
  nodeName.value = row.name
  // 转换为数组格式用于表单展示
  labelTags.value = Object.entries(row.labels || {}).map(([name, value]) => ({
    name,
    value
  }))
}
// 添加标签
const addLabelTag = () => {
  labelTags.value.push({
    name: '',
    value: ''
  });
};
// 取消
const labelCancelClick = () => {
  drawerLabels.value = false
};

// 提交表单(标签)
const labelsUpdateForm = async () => {
  // 转换为 labels 对象格式
  const labels = {};
  labelTags.value.forEach(tag => {
    if (tag.name.trim()) {
      labels[tag.name] = tag.value;
    }
  });
  const response = await updateNodeLabels(clusterID.value, nodeName.value, { labels }) as ApiResponse;
  if (!response.success) {
    showApiError(`节点 ${nodeName.value} 标签更新失败. 错误信息: ${response.msg}`);
    return;
  }

  drawerLabels.value = false;

  message(`节点 ${nodeName.value} 标签更新成功!`, {
    type: "success"
  });
};

// 删除标签
const deleteLabelTag = (index: number) => {
  labelTags.value.splice(index, 1);
};

// 调度设置
const cordonDialogVisible = ref(false)
const cordonNodeName = ref<string>('')
const cordonStatus = ref<boolean>(false)
const cordonLoading = ref(false)
const manageCordon = (row: Node) => {
  cordonDialogVisible.value = true
  cordonNodeName.value = row.name
  console.log(row.unschedulable)
  cordonStatus.value = !row.unschedulable
}
const cordonCancelClick = () => {
  cordonDialogVisible.value = false
}
const cordonSubmit = async () => {
  if (!clusterID.value) {
    message('请先选择集群', { type: "warning" })
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认切换节点 ${cordonNodeName.value} 的调度状态吗？`,
      '提示',
      {
        confirmButtonText: '确 认',
        cancelButtonText: '取 消',
        type: 'warning'
      }
    )
  } catch {
    return
  }
  cordonLoading.value = true
  try {
    const response = await updateNodeCordon(clusterID.value, cordonNodeName.value) as ApiResponse
    if (!response.success) {
      showApiError(`节点 ${cordonNodeName.value} 调度状态更新失败. 错误信息: ${response.msg}`)
      return
    }
    message(`节点 ${cordonNodeName.value} 调度状态更新成功!`, {
      type: "success"
    })
    cordonDialogVisible.value = false
    tableData()
  } finally {
    cordonLoading.value = false
  }
}

// 污点管理
const directionTaints = ref<DrawerProps['direction']>()
const drawerTaints = ref(false)
const taintTags = ref([])
const manageTaints = (row:  Node) => {
  drawerTaints.value = true
  nodeName.value = row.name
  taintTags.value = row.taints
}

// 提交表单(污点)
const taintsUpdateForm = async () => {
  // 构建请求数据
  const taints = taintTags.value.map(taint => ({
    key: taint.key.trim(),
    value: taint.value.trim(),
    effect: taint.effect
  }));
  const response = await updateNodeTaints(clusterID.value, nodeName.value, { taints }) as ApiResponse;
  if (!response.success) {
    showApiError(`节点 ${nodeName.value} 污点更新失败. 错误信息: ${response.msg}`);
    return;
  }

  drawerTaints.value = false;

  message(`节点 ${nodeName.value} 污点更新成功!`, {
    type: "success"
  });
};

// 添加污点
const addTaintTag = () => {
  // 确保是数组
  if (!Array.isArray(taintTags.value)) {
    console.warn('taintTags 不是数组，重新初始化');
    taintTags.value = [];
  }
  // 添加新项
  taintTags.value.push({
    key: '',
    value: '',
    effect: 'NoSchedule'
  });
};

// 删除污点
const deleteTaintTag = (index: number) => {
  taintTags.value.splice(index, 1);
};
// 取消
const taintCancelClick = () => {
  drawerTaints.value = false
};
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-select v-model="clusterID" placeholder="请选择" @change="selectChange" style="width: 240px">
        <el-option
          v-for="item in clusterOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="pagedData" stripe style="width: 100%">
      <el-table-column fixed prop="name" label="节点名称" show-overflow-tooltip></el-table-column>
      <el-table-column prop="status" label="节点状态" width="140">
        <template #default="scope">
          <el-tag :type="scope.row.status ? 'success' : 'danger'">
            {{ scope.row.status ? 'Ready' : 'NotReady' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="unschedulable" label="调度状态" width="140">
        <template #default="scope">
          <el-tag :type="scope.row.unschedulable ? 'danger' : 'success'">
            {{ scope.row.unschedulable ? '不可调度' : '可调度' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="address" label="节点 IP" width="170"></el-table-column>
      <el-table-column prop="containerRuntimeVersion" label="Runtime 版本"></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170"></el-table-column>
      <el-table-column fixed="right" label="操作" width="255">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="goToNodeDetails({ id: clusterID, name: scope.row.name }, 'params')">
            详情
          </el-button>
          <el-button link type="primary" size="small" @click="manageCordon(scope.row)">
            调度设置
          </el-button>
          <el-button link type="primary" size="small" @click="manageTaints(scope.row)">
            污点管理
          </el-button>
          <el-button link type="primary" size="small" @click="manageLabels(scope.row)">
            标签管理
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 表格分页 -->
    <el-pagination
      background
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next,"
      :total="pagination.total"
      style="float: right;"
    />
    <!-- 标签管理 -->
    <el-drawer title="标签管理" v-model="drawerLabels" :direction="directionLabels" resizable size="55%">
      <el-form :inline="true" :model="data" class="demo-form-inline" :label-position="'top'">
        <div v-for="(label, index) in labelTags" :key="index" class="tag-item">
          <div class="tag-inputs">
            <el-form-item>
              <el-input
                v-model="label.name"
                placeholder="标签键"
                style="width: 400px"
              ></el-input>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="label.value"
                placeholder="标签值"
                style="width: 400px"
              ></el-input>
            </el-form-item>
            <el-button @click="deleteLabelTag(index)" :icon="Delete" circle />
          </div>
        </div>
        <el-button @click="addLabelTag" type="primary" plain>
          <el-icon><Plus /></el-icon>
          <span>添加标签</span>
        </el-button>
      </el-form>
      <template #footer>
        <el-divider />
        <div class="dialog-footer">
          <el-button @click="labelCancelClick">取 消</el-button>
          <el-button type="primary" @click="labelsUpdateForm">确 认</el-button>
        </div>
      </template>
    </el-drawer>
    <!-- 污点管理 -->
    <el-drawer title="污点管理" v-model="drawerTaints" :direction="directionTaints" resizable size="55%">
      <el-form :inline="true" :model="data" class="demo-form-inline" :label-position="'top'">
        <div v-for="(taint, index) in taintTags" :key="index" class="tag-item">
          <div class="tag-inputs">
            <el-form-item>
              <el-input
                v-model="taint.key"
                placeholder="名称"
                style="width: 310px"
              ></el-input>
            </el-form-item>
            <el-form-item>
              <el-select
                v-model="taint.effect"
                placeholder="请选择"
                style="width: 200px"
              >
                <el-option label="NoExecute" value="NoExecute" />
                <el-option label="NoSchedule" value="NoSchedule" />
                <el-option label="PreferNoSchedule" value="PreferNoSchedule" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="taint.value"
                placeholder="值"
                style="width: 310px"
              ></el-input>
            </el-form-item>
            <el-button @click="deleteTaintTag(index)" :icon="Delete" circle />
          </div>
        </div>
        <el-button @click="addTaintTag" type="primary" plain>
          <el-icon><Plus /></el-icon>
          <span>添加污点</span>
        </el-button>
      </el-form>
      <template #footer>
        <el-divider />
        <div class="dialog-footer">
          <el-button @click="taintCancelClick">取 消</el-button>
          <el-button type="primary" @click="taintsUpdateForm">确 认</el-button>
        </div>
      </template>
    </el-drawer>
    <!-- 调度设置 -->
    <el-dialog title="调度设置" v-model="cordonDialogVisible" width="420px" @closed="cordonCancelClick">
      <el-form :model="data" :label-position="'left'">
        <el-form-item label="节点调度">
          <el-switch
            v-model="cordonStatus"
            inline-prompt
            :active-icon="Check"
            :inactive-icon="Close"
            style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cordonCancelClick">取 消</el-button>
        <el-button type="primary" :loading="cordonLoading" @click="cordonSubmit">确 认</el-button>
      </template>
    </el-dialog>
    <!-- 表单操作 -->
  </div>
</template>

<style scoped lang="scss">
.el-form-item {
  margin-right: 10px;
  margin-bottom: 10px;
}

.tag-inputs {
  display: flex;
}

</style>
