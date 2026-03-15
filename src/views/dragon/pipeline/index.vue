<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from 'vue'
import {
  getPipelines,
  createPipeline,
  deletePipeline,
  updatePipeline,
  getProjects,
  getEnvironments,
  getCredentials,
  getGitlabGroups,
  getGitlabProjects,
  createPipelineAclBatch,
  getPipelineAcls,
  deletePipelineAcl,
  getTektonPipelines
} from '@/api/dragon'
import { getUsers } from '@/api/authn'
import { message } from "@/utils/message"
import { CascaderProps, FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import {Plus, Refresh} from "@element-plus/icons-vue"
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import ShellEditor from "@/components/ShellEditor/index.vue";
import { useDetailRoutes } from "@/utils/hooks/useDetailRoute";
import dayjs from "dayjs";

const { goToReleases } = useDetailRoutes();

defineOptions({ name: "DRGPipeline" })

// 类型定义
interface Pipeline {
  id: number
  name: string
  environmentID: number
  gitlabID: number
  gitlabGroupID: number
  gitlabProjectID: number
  task: string
  script: string
  isApproval: boolean
  createAt: string
  updatedAt: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination: Pagination
  code: number
  msg?: string
  success: boolean
}

interface UserOption {
  id: number
  username: string
}

interface PipelineAcl {
  id: number
  userId: number
  username?: string
  action: string
  creator?: string
  createdAt?: string
}

// 使用组合函数管理分页和搜索
const { pagination, refresh } = usePaginatedSearch(fetchPipelines, {
  debounceTime: 800,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'asc'
})

// 表格数据
const data = ref<Pipeline[]>([])

// 对话框相关
const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const aclDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const currentEditId = ref<number>()
const currentPipelineId = ref<number>()
const currentPipeline = ref<Pipeline | null>(null)
const projectId = ref<number>()
const environmentId = ref<number>()
const pipelineOptions = ref([])
const gitlabCascaderValue = ref([])
const userOptions = ref<UserOption[]>([])
const aclList = ref<PipelineAcl[]>([])
const aclLoading = ref(false)
const detailTab = ref<'base' | 'acl'>('base')

// 计算属性
const hasValidSelection = computed(() =>
  projectId.value !== undefined && environmentId !== undefined
);

onMounted(() => {
  fetchTektonPipelines() // 获取 Tekton Pipelines（使用固定集群）
})

const cascaderProps: CascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, data } = node
    try {
      if (level === 0) {
        // 第一级：加载项目列表
        const projects = await fetchList<{ id: number; name: string }>(() => getProjects({ page: 1, size: 100 }))
        resolve(projects.map(project => ({
          value: project.id,
          label: project.name,
          leaf: false
        })))
      } else if (level === 1) {
        // 第二级：加载指定项目的环境列表
        const projectId = data.value
        const environments = await fetchList<{ id: number; name: string }>(() => getEnvironments(projectId as number,{ page: 1, size: 100 }))
        resolve(environments.map(env => ({
          value: env.id,
          label: env.name,
          leaf: true
        })))
      } else {
        resolve([])
      }
    } catch (error) {
      message(error instanceof Error ? error.message : '获取数据失败')
      resolve([])
    }
  }
}

// Cascader 处理选择变化
const handleCascaderChange = async (value: string[]) => {
  if (value && value.length === 2) {
    projectId.value = parseInt(value[0])
    environmentId.value = parseInt(value[1])
    refresh() // 刷新表格数据
  } else {
    data.value = []
  }
}


/**
 * Gitlab 获取项目列表
 */
const cascaderGitlabProps: CascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, data, pathNodes } = node
    try {
      if (level === 0) {
        // 第一级：加载 Gitlab 凭证列表
        const credList = await fetchList<{ id: number; baseURL: string }>(() => getCredentials({ ...{ page: 1, size: 100 }, ...{ type: 'gitlab' } }))
        resolve(credList.map(c => ({
          value: c.id,
          label: c.baseURL,
          leaf: false
        })))
      } else if (level === 1) {
        // 第二级：加载指定 Gitlab 的 Group 列表
        const gitId = data.value
        const groups = await fetchList<{ id: number; name: string }>(() => getGitlabGroups(gitId as number))
        resolve(groups.map(group => ({
          value: group.id,
          label: group.name,
          leaf: false
        })))
      } else if (level === 2) {
        // 第三级：加载指定 Gitlab 的 Project 列表
        // 从 pathNodes 中获取第一级的 gitId
        const gitNode = pathNodes[0]  // 第一级节点
        const gitId = gitNode.data.value
        const gitGroupId = data.value
        const projects = await fetchList<{ id: number; name: string }>(() =>
          getGitlabProjects(gitId, gitGroupId as number)
        )
        resolve(projects.map(proj => ({
          value: proj.id,
          label: proj.name,
          leaf: true
        })))
      } else {
        resolve([])
      }
    } catch (error) {
      message(error instanceof Error ? error.message : '获取数据失败')
      resolve([])
    }
  }
}

const handleCascaderGitlabChange = async (value: number[]) => {
  if (value && value.length === 3) {
    gitlabCascaderValue.value = value
    dataForm.gitlabID = value[0]
    dataForm.gitlabGroupID = value[1]
    dataForm.gitlabProjectID = value[2]
  } else {
    dataForm.gitlabID = undefined
    dataForm.gitlabGroupID = undefined
    dataForm.gitlabProjectID = undefined
    data.value = []
  }
}

// 表单数据
const dataForm = reactive<Omit<Pipeline, 'id' | 'createAt' | 'updatedAt'>>({
  name: undefined,
  environmentID: undefined,
  gitlabID: undefined,
  gitlabGroupID: undefined,
  gitlabProjectID: undefined,
  task: undefined,
  script: undefined,
  isApproval: false
})
const textMap = { update: '更新管道', create: '创建管道' }

/**
 * 获取 Tekton Pipeline 列表
 */
const fetchTektonPipelines = async () => {
  try {
    const response = await getTektonPipelines() as ApiResponse<[]>
    pipelineOptions.value = response.data || []
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

/** 通用 fetch 函数 */
async function fetchList<T>(apiCall: () => Promise<{ data?: T[] }>, fallback: T[] = []): Promise<T[]> {
  try {
    const res = await apiCall()
    return res.data || fallback
  } catch (error) {
    message(error instanceof Error ? error.message : "获取数据失败")
    return fallback
  }
}

/**
 * 获取管道列表
 */
async function fetchPipelines(p: Pagination) {
  try {
    const response = await getPipelines(projectId.value, environmentId.value,{
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      keyword: p.keyword,
    }) as ApiResponse<Pipeline[]>
    data.value = response.data ?? []
    pagination.value.total = response.pagination.total
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败')
  }
}

// 表单校验规则
const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入发布名称.', trigger: 'blur' }],
})

const aclRules = reactive<FormRules>({
  users: [{ required: true, message: '请选择授权用户.', trigger: 'change' }],
  action: [{ required: true, message: '请选择权限动作.', trigger: 'change' }]
})

const formatDate = (value?: string) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

// CRUD 操作
const addClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择项目和环境', { type: 'warning', duration: 5000 });
    return
  }
  dialogStatus.value = 'create'
  resetForm()
  dialogFormVisible.value = true
}

const refreshClick = () => {
  if (!hasValidSelection.value) {
    message('请先选择项目和环境', { type: 'warning', duration: 5000 });
    return
  }
  refresh()
}

const fetchAclList = async (pipelineId: number) => {
  if (!projectId.value || !environmentId.value) return
  aclLoading.value = true
  try {
    const response = await getPipelineAcls(projectId.value, environmentId.value, pipelineId, { page: 1, size: 100 }) as ApiResponse<PipelineAcl[]>
    aclList.value = response.data ?? []
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败', { type: 'error' })
  } finally {
    aclLoading.value = false
  }
}

const openDetailDialog = async (row: Pipeline) => {
  if (!hasValidSelection.value) {
    message('请先选择项目和环境', { type: 'warning', duration: 5000 });
    return
  }
  currentPipeline.value = row
  currentPipelineId.value = row.id
  detailTab.value = 'base'
  await fetchAclList(row.id)
  detailDialogVisible.value = true
}

const openAclDialog = async (row?: Pipeline) => {
  if (!hasValidSelection.value) {
    message('请先选择项目和环境', { type: 'warning', duration: 5000 });
    return
  }
  if (row) currentPipelineId.value = row.id
  aclForm.users = []
  aclForm.action = undefined
  if (!userOptions.value.length) {
    userOptions.value = await fetchList<UserOption>(() => getUsers({ page: 1, size: 100 }))
  }
  aclDialogVisible.value = true
}

const editClick = (row: Pipeline) => {
  currentEditId.value = row.id
  Object.assign(dataForm, row)
  gitlabCascaderValue.value = [
    row.gitlabID,
    row.gitlabGroupID,
    row.gitlabProjectID
  ]
  console.log(dataForm)
  dialogStatus.value = 'update'
  dialogFormVisible.value = true
}

const resetForm = () => {
  Object.assign(dataForm, { name: undefined, description: undefined })
  nextTick(() => dataFormRef.value?.clearValidate())
}

const handleDialogClosed = () => {
  dataFormRef.value?.clearValidate()
}

const handleAclDialogClosed = () => {
  aclFormRef.value?.clearValidate()
}

const handleFormSubmit = async (formEl: FormInstance | undefined, operation: 'create' | 'update', rowId?: number) => {
  if (!formEl) return
  if (operation === 'update' && rowId === undefined) return

  try {
    await formEl.validate()
    console.log(dataForm)
    const response = operation === 'create'
      ? await createPipeline(projectId.value, environmentId.value, dataForm) as ApiResponse<Pipeline>
      : await updatePipeline(projectId.value, environmentId.value, rowId!, dataForm) as ApiResponse<Pipeline>

    if (!response.success) {
      message(`数据${operation === 'create' ? '添加' : '更新'}失败. 错误信息: ${response.msg}`, { type: 'error' })
      return
    }

    dialogFormVisible.value = false

    if (operation === 'create') data.value.push(response.data!)
    else {
      const index = data.value.findIndex(item => item.id === rowId)
      if (index !== -1) data.value.splice(index, 1, response.data!)
    }

    message(`数据${operation === 'create' ? '添加' : '更新'}成功!`, { type: 'success' })
  } catch (error) {
    message(error instanceof Error ? error.message : '操作失败', { type: 'error' })
  }
}

const aclFormRef = ref<FormInstance>()
const aclForm = reactive<{ users: number[]; action: 'view' | 'deploy' | 'approve' | 'rollback' | undefined }>({
  users: [],
  action: undefined
})

const handleAclSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  if (!currentPipelineId.value || !projectId.value || !environmentId.value) return
  try {
    await formEl.validate()
    const response = await createPipelineAclBatch(projectId.value, environmentId.value, currentPipelineId.value, {
      users: aclForm.users,
      action: aclForm.action
    }) as ApiResponse<void>
    if (!response.success) {
      message(`授权失败. 错误信息: ${response.msg}`, { type: 'error' })
      return
    }
    aclDialogVisible.value = false
    await fetchAclList(currentPipelineId.value)
    message('授权成功!', { type: 'success' })
  } catch (error) {
    message(error instanceof Error ? error.message : '操作失败', { type: 'error' })
  }
}

const handleAclDelete = async (aclId: number) => {
  if (!currentPipelineId.value || !projectId.value || !environmentId.value) return
  try {
    await ElMessageBox.confirm('确认删除该授权？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const response = await deletePipelineAcl(projectId.value, environmentId.value, currentPipelineId.value, aclId) as ApiResponse<void>
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: 'error' })
      return
    }
    await fetchAclList(currentPipelineId.value)
    message('授权删除成功!', { type: 'success' })
  } catch (error) {
    if (error !== 'cancel') message(error instanceof Error ? error.message : '删除操作出错', { type: 'error' })
  }
}

const createForm = (formEl: FormInstance | undefined) => handleFormSubmit(formEl, 'create')
const updateForm = (formEl: FormInstance | undefined, rowId?: number) => handleFormSubmit(formEl, 'update', rowId)

const handleDelete = async (rowId: number) => {
  try {
    await ElMessageBox.confirm('此操作不可撤销，确定要执行删除操作吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })

    const response = await deletePipeline(projectId.value, environmentId.value, rowId) as ApiResponse<void>
    if (!response.success) {
      message(`删除失败. 错误信息: ${response.msg}`, { type: 'error' })
      return
    }

    const index = data.value.findIndex(item => item.id === rowId)
    if (index !== -1) data.value.splice(index, 1)
    pagination.value.total -= 1

    if (data.value.length === 0 && pagination.value.page > 1) {
      pagination.value.page -= 1
      refresh()
    }
    message('数据删除成功!', { type: 'success', duration: 5000 })
  } catch (error) {
    if (error !== 'cancel') message(`删除操作出错: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' })
    else message('已取消删除操作!', { type: 'info', duration: 5000 })
  }
}

</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-cascader :props="cascaderProps" @change="handleCascaderChange" placeholder="选择项目 / 环境" style="min-width: 300px"/>

      <el-button type="primary" plain @click="addClick" style="margin-left: 5px">
        <el-icon><Plus /></el-icon>
        <span>新 增</span>
      </el-button>
      <el-button type="info" plain style="margin-left: 5px;" @click="refreshClick">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="name" label="发布名称"></el-table-column>
      <el-table-column prop="task" label="发布任务"></el-table-column>
      <el-table-column prop="creator" label="创建人"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间"/>
      <el-table-column fixed="right" label="操作" width="180">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="goToReleases({
            projectId: projectId,
            environmentId: environmentId,
            pipelineId: scope.row.id
          })">
            构建
          </el-button>
          <el-button link type="primary" size="small" @click="openDetailDialog(scope.row)">
            详情
          </el-button>
          <el-button link type="primary" size="small" @click="editClick(scope.row)">
            编辑
          </el-button>
          <el-button link type="primary" size="small" @click="handleDelete(scope.row.id)">
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
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="应用名称" prop="name" :label-width="formLabelWidth">
          <el-input v-model="dataForm.name"/>
        </el-form-item>
        <el-form-item label="构建模板" prop="task" :label-width="formLabelWidth">
          <el-select
            v-model="dataForm.task"
            placeholder="请选择构建模板"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="item in pipelineOptions"
              :key="item.name"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="GIT URL" prop="repoUrl" :label-width="formLabelWidth">
          <el-cascader v-model="gitlabCascaderValue" :props="cascaderGitlabProps" @change="handleCascaderGitlabChange" placeholder="选择 GitLab 实例 / GitLab 组织 / GitLab 项目"  style="width: 100%"/>
        </el-form-item>
        <el-form-item label="启用审核" prop="isApproval" :label-width="formLabelWidth">
          <el-switch v-model="dataForm.isApproval" />
        </el-form-item>
        <el-form-item label="脚本参数" prop="script" :label-width="formLabelWidth">
          <ShellEditor
            v-model="dataForm.script"
            :height="'300px'"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogFormVisible = false">取 消</el-button>
          <el-button type="primary" @click="dialogStatus==='create'?createForm(dataFormRef):updateForm(dataFormRef, currentEditId)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog title="Pipeline 详情" v-model="detailDialogVisible" width="70%">
      <el-tabs v-model="detailTab" type="border-card">
        <el-tab-pane label="基础配置" name="base">
          <el-descriptions :column="2">
            <el-descriptions-item label="发布名称">{{ currentPipeline?.name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发布任务">{{ currentPipeline?.task || '-' }}</el-descriptions-item>
            <el-descriptions-item label="启用审核">{{ currentPipeline?.isApproval ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatDate(currentPipeline?.updatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="脚本参数" :span="2">
              <pre style="white-space: pre-wrap; margin: 0;">{{ currentPipeline?.script || '-' }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane label="权限（ACL）" name="acl">
          <div style="margin-bottom: 10px;">
            <el-button type="primary" plain  @click="openAclDialog()">
              <el-icon><Plus /></el-icon>
              <span>新 增</span>
            </el-button>
          </div>
          <el-table :data="aclList" stripe v-loading="aclLoading">
            <el-table-column prop="userName" label="用户"></el-table-column>
            <el-table-column prop="action" label="动作" />
            <el-table-column prop="creator" label="创建人" />
            <el-table-column prop="createdAt" label="时间">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column fixed="right" label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="handleAclDelete(row.id)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <el-dialog title="授权" v-model="aclDialogVisible" width="40%" @closed="handleAclDialogClosed">
      <el-form ref="aclFormRef" :model="aclForm" :rules="aclRules">
        <el-form-item label="授权用户" prop="users" :label-width="formLabelWidth">
          <el-select v-model="aclForm.users" multiple filterable placeholder="选择用户" style="width: 100%">
            <el-option v-for="u in userOptions" :key="u.id" :label="u.username" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="权限动作" prop="action" :label-width="formLabelWidth">
          <el-select v-model="aclForm.action" placeholder="选择动作" style="width: 100%">
            <el-option label="view" value="view" />
            <el-option label="deploy" value="deploy" />
            <el-option label="approve" value="approve" />
            <el-option label="rollback" value="rollback" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="aclDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleAclSubmit(aclFormRef)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">

</style>
