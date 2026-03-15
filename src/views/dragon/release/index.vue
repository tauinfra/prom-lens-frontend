<script setup lang="ts">
import { ref, Ref, reactive, nextTick, computed, onMounted } from 'vue'
import {
  getPipeline,
  createRelease,
  getRelease,
  getGitlabTags,
  getGitlabBranches,
  getReviews,
  updateReview, getReleases
} from '@/api/dragon'
import { message } from "@/utils/message"
import { FormInstance, FormRules } from 'element-plus'
import { getToken } from "@/utils/auth"
import { AnsiUp } from 'ansi_up'
import { Refresh, Plus, CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import { usePaginatedSearch, type Pagination } from '@/utils/hooks/usePaginatedSearch'
import dayjs from 'dayjs'
import { useRoute } from 'vue-router'
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";

defineOptions({
  name: "DRGReleases"
});

// 类型定义
export interface Release {
  id: number
  taskID: string
  projectID: number
  projectName: string
  environmentID: number
  environmentName: string
  pipelineID: number
  pipelineName: string
  gitRef: string
  gitRefType: 'branch' | 'tag'
  gitCommit: string
  imageRegistry: string
  imageName: string
  imageTag: string
  releaseStatus: 'pending' | 'progressing' | 'success' | 'failed'
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected'
  description?: string
  creator: string
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

interface Review {
  id: number
  step: number
  status: 'pending' | 'approved' | 'rejected'
  comment?: string
  createdAt?: string
  updatedAt?: string
  reviewedAt?: string
}

interface ApiResponse<T = any> {
  data?: T
  pagination?: Pagination
  code: number
  msg?: string
  success: boolean
}

// ------------------- 封装路由参数 -------------------
const route = useRoute()
const getParams = {
  projectId: Number(route.params.projectId),
  environmentId: Number(route.params.environmentId),
  pipelineId: Number(route.params.pipelineId)
}

// ------------------- 响应式数据 -------------------
const data = ref<Release[]>([])
const pipeline = ref<any | null>(null)
const release = ref<Release | null>(null)
const branchOptions = ref<any[]>([])
const tagOptions = ref<any[]>([])
const reviewList = ref<Review[]>([])

const dialogStatus = ref<'create' | 'update'>('create')
const dialogFormVisible = ref(false)
const dialogInfoVisible = ref(false)
const approvalDialogVisible = ref(false)
const dataFormRef = ref<FormInstance>()
const formLabelWidth = '100px'
const comment = ref<string>('')

// ------------------- 分页 -------------------
const { pagination, refresh } = usePaginatedSearch(fetchReleases, {
  debounceTime: 800,
  initialPage: 1,
  initialSize: 10,
  initialSortBy: 'id',
  initialSortOrder: 'desc'
})

// ------------------- API 方法 -------------------
async function fetchReleases(p: Pagination) {
  try {
    const response = await getReleases(getParams.projectId, getParams.environmentId, getParams.pipelineId, {
      page: p.page,
      size: p.size,
      sortBy: p.sortBy,
      sortOrder: 'desc', // 倒序查看发布记录
      keyword: p.keyword,
    }) as ApiResponse<Release[]>
    data.value = response.data ?? []
    if (response.pagination) pagination.value.total = response.pagination.total
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败', { type: 'error' })
  }
}

// 查看数据列表
const fetchList = async <T>(
  apiFn: (...args: any[]) => Promise<any>,
  targetRef: Ref<T | null>,
  ...params: any[]
) => {
  try {
    const response = await apiFn(...params) as ApiResponse<T>
    if (!response.success) {
      message(response.msg, { type: 'error' })
      return
    }
    targetRef.value = response.data ?? null
  } catch (error) {
    message(error instanceof Error ? error.message : '获取数据失败', { type: 'error' })
  }
}

const fetchGitlabBranch = (gitlabId: number, projectId: number) =>
  fetchList(() => getGitlabBranches(gitlabId, projectId), branchOptions)

const fetchGitlabTag = (gitlabId: number, projectId: number) =>
  fetchList(() => getGitlabTags(gitlabId, projectId), tagOptions)

const fetchReviews = (projectId, environmentId, pipelineId, releaseId: number) =>
  fetchList(() => getReviews(projectId, environmentId, pipelineId, releaseId, { page: 1, size: 100 }), reviewList)

// ------------------- 时间格式化 -------------------
const formatDate = (value?: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string => {
  if (!value) return '-'
  return dayjs(value).format(format)
}

const formatDuration = (start?: string, end?: string): string => {
  if (!start || !end) return '-'
  const diffMs = Math.abs(new Date(end).getTime() - new Date(start).getTime())
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60)
  const seconds = Math.floor((diffMs / 1000) % 60)
  if (hours > 0) return `${hours}小时 ${minutes}分 ${seconds}秒`
  if (minutes > 0) return `${minutes}分 ${seconds}秒`
  return `${seconds}秒`
}

// ------------------- 表单 -------------------
const textMap = { create: '创建发布任务' }

const rules = reactive<FormRules>({
  gitRef: [{ required: true, message: '请选择分支 / Tag.', trigger: 'blur' }],
  description: [{ required: true, message: '请输入发布描述.', trigger: 'blur' }],
})

interface ReleaseDataForm {
  gitRef: string
  description: string
}

const dataForm = reactive<ReleaseDataForm>({
  gitRef: undefined,
  description: undefined
})

const resetForm = () => {
  Object.assign(dataForm, { gitRef: undefined, description: undefined })
  nextTick(() => dataFormRef.value?.clearValidate())
}

const handleDialogClosed = () => dataFormRef.value?.clearValidate()

// ------------------- 创建/更新 -------------------
const handleFormSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return console.error('表单引用未获取到')

  try {
    await formEl.validate()

    const response = await createRelease(getParams.projectId, getParams.environmentId, getParams.pipelineId, dataForm) as ApiResponse<Release>

    if (!response.success) {
      return message(`发布任务创建失败: ${response.msg}`, { type: 'error' })
    }
    dialogFormVisible.value = false
    releaseId.value = response.data?.id
    activeTab.value = 'log'
    dialogInfoVisible.value = true
    // 未启用审核，创建后开启日志查看
    if (response.data?.approvalStatus == "none") {
      handleTabChange('log')
    }
    message('发布任务创建成功!', { type: 'success' })
    refresh()
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '操作失败'
    message(errorMessage, { type: 'error' })
  }
}

const createForm = (formEl: FormInstance | undefined) => handleFormSubmit(formEl)

// ------------------- 按钮事件 -------------------
const addClick = () => {
  dialogStatus.value = 'create'
  dialogFormVisible.value = true
  resetForm()
  if (!pipeline.value) {
    message('当前用户无权限获取管道信息，无法拉取分支/Tag', { type: 'warning' })
    return
  }
  if (!pipeline.value.gitlabID || !pipeline.value.gitlabProjectID) {
    message('管道未配置 Gitlab 信息，无法拉取分支/Tag', { type: 'warning' })
    return
  }
  fetchGitlabBranch(pipeline.value.gitlabID, pipeline.value.gitlabProjectID) // 获取 GIT 项目分支
  fetchGitlabTag(pipeline.value.gitlabID, pipeline.value.gitlabProjectID) // 获取 GIT 项目 TAG
}

const refreshClick = () => {
  refresh()
}

// ------------------- 发布详情 -------------------
const activeTab = ref<'log'|'info'>('info')
const releaseId = ref<number>()
const logs = ref<string[]>([])
const logContainer = ref<HTMLElement | null>(null)

const infoClick = async (rowId: number) => {
  releaseId.value = rowId
  await fetchList(getRelease, release, getParams.projectId, getParams.environmentId, getParams.pipelineId, releaseId.value)
  activeTab.value = 'info'
  dialogInfoVisible.value = true
}

const handleTabChange = (tabName: string) => {
  if (tabName === "log") {
    logs.value = []
    connWS(`${baseUrl}/${releaseId.value}/logs`)
  } else if (tabName === "info") {
    fetchList(getRelease, release, getParams.projectId, getParams.environmentId, getParams.pipelineId, releaseId.value)
  }
}

// ------------------- WebSocket -------------------
const ansi_up = new AnsiUp()
const token = getToken()?.accessToken
let ws: WebSocket | null = null
const baseUrl = `ws://127.0.0.1:8080/api/v1/dragon/projects/${getParams.projectId}/environments/${getParams.environmentId}/pipelines/${getParams.pipelineId}/releases`

const connWS = (url: string) => {
  if (ws) ws.close()
  ws = new WebSocket(url, token)
  ws.onopen = () => console.log('WebSocket 已连接')
  ws.onmessage = (event) => {
    logs.value.push(ansi_up.ansi_to_html(event.data))
    scrollToBottom()
  }
  ws.onerror = (event) => console.log('WebSocket 错误:', event)
  ws.onclose = () => console.log('WebSocket 已关闭')
}

const scrollToBottom = () => nextTick(() => {
  if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
})

// ------------------- 审批 -------------------
const approvalClick = async (row: Release) => {
  release.value = row
  releaseId.value = row.id
  await fetchReviews(getParams.projectId, getParams.environmentId, getParams.pipelineId, release.value.id)
  approvalDialogVisible.value = true
}

const normalizeReviewStatus = (status?: Review["status"] | string) =>
  (status ?? '').toString().trim().toLowerCase()

const isApprovedStatus = (status?: Review["status"] | string) => {
  const v = normalizeReviewStatus(status)
  return ['approved', 'pass', 'passed', 'success'].includes(v)
}

const isRejectedStatus = (status?: Review["status"] | string) => {
  const v = normalizeReviewStatus(status)
  return ['rejected', 'reject', 'failed', 'fail', 'error', 'denied'].includes(v)
}

const isPendingStatus = (status?: Review["status"] | string) => {
  const v = normalizeReviewStatus(status)
  if (!v) return true
  return [
    'pending',
    'process',
    'processing',
    'wait',
    'waiting',
    'todo',
    'to_do',
    'in_progress',
    'in-progress'
  ].includes(v)
}

const currentStep = computed(() => {
  if (!reviewList.value.length) return 0
  const sorted = [...reviewList.value].sort((a, b) => a.step - b.step)
  const rejected = sorted.find(r => isRejectedStatus(r.status))
  if (rejected) return rejected.step + 1
  const pending = sorted.find(r => isPendingStatus(r.status))
  if (pending) return pending.step
  return sorted[sorted.length - 1].step + 1
})

const pendingReview = computed(() =>
  hasRejected.value
    ? null
    : reviewList.value.find(r => isPendingStatus(r.status)) ?? null
)
const hasRejected = computed(() =>
  reviewList.value.some(r => isRejectedStatus(r.status))
)
const canApprove = computed(() => !hasRejected.value && !!pendingReview.value)

const stepStatus = (step: number): 'wait' | 'process' | 'success' | 'error' => {
  const review = reviewList.value.find(r => r.step === step)
  if (!review) return 'wait'
  if (isApprovedStatus(review.status)) return 'success'
  if (isRejectedStatus(review.status)) return 'error'
  if (isPendingStatus(review.status)) return 'process'
  return 'process'
}

const getReviewActionTime = (review: Review) => {
  return review.reviewedAt || review.updatedAt || review.createdAt
}

const getReviewByStep = (step: number) => reviewList.value.find(r => r.step === step)

const getReviewerName = (review?: Review | null) => {
  if (!review) return '-'
  const anyReview = review as Review & {
    reviewer?: string
    reviewerName?: string
    approver?: string
    approverName?: string
    operator?: string
    operatorName?: string
    creator?: string
  }
  return (
    anyReview.reviewerName ||
    anyReview.reviewer ||
    anyReview.approverName ||
    anyReview.approver ||
    anyReview.operatorName ||
    anyReview.operator ||
    anyReview.creator ||
    '-'
  )
}

const getReviewStepDescription = (step: number) => {
  const review = getReviewByStep(step)
  const reviewer = getReviewerName(review)
  const reviewTime =
    review && (isApprovedStatus(review.status) || isRejectedStatus(review.status))
      ? formatDate(getReviewActionTime(review))
      : '待审批'
  return `审批人员：${reviewer}\n审批时间：${reviewTime}`
}

const latestApprovalTime = computed(() => {
  const completedReviews = reviewList.value
    .filter(r => isApprovedStatus(r.status) || isRejectedStatus(r.status))
    .map(r => ({ review: r, time: getReviewActionTime(r) }))
    .filter(item => !!item.time)
    .sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())
  return completedReviews[0]?.time
})

const currentStage = computed(() => {
  if (!reviewList.value.length) return '申请提交'
  if (hasRejected.value) return '审批已拒绝'
  const pending = reviewList.value.find(r => isPendingStatus(r.status))
  if (pending) return `审批中（第 ${pending.step} 步）`
  return '审批完成'
})

const isSubmitStage = computed(() => !reviewList.value.length)

const submitStepStatus = (): 'wait' | 'process' | 'success' => {
  return currentStep.value > 0 ? 'success' : 'process'
}

/** 审批拒绝时的步骤（1=测试人员，2=测试负责人），无拒绝为 -1 */
const rejectedStep = computed(() => {
  const r = reviewList.value.find(r => isRejectedStatus(r.status))
  return r != null ? r.step : -1
})

/** 审批拒绝时的拒绝原因（来自被拒绝那步的 comment） */
const rejectedReason = computed(() => {
  const r = reviewList.value.find(r => isRejectedStatus(r.status))
  const text = r?.comment?.trim()
  return text || '未填写'
})

const approvalStageCards = computed(() => [
  {
    title: '申请提交',
    status: submitStepStatus(),
    description: `发起人员：${release.value?.creator || '-'}\n提交时间：${formatDate(release.value?.createdAt)}`
  },
  {
    title: '测试人员',
    status: stepStatus(1),
    description: getReviewStepDescription(1) + (hasRejected.value && rejectedStep.value === 1 ? `\n拒绝原因：${rejectedReason.value}` : '')
  },
  {
    title: '测试负责人',
    status: stepStatus(2),
    description: getReviewStepDescription(2) + (hasRejected.value && rejectedStep.value === 2 ? `\n拒绝原因：${rejectedReason.value}` : '')
  }
])

/** 可见阶段卡片：拒绝后只显示到被拒绝的那一步，不显示后续步骤 */
const visibleApprovalStageCards = computed(() => {
  const cards = approvalStageCards.value
  if (hasRejected.value && rejectedStep.value >= 0) {
    return cards.slice(0, rejectedStep.value + 1)
  }
  return cards
})

/** 当前高亮阶段在可见列表中的下标（拒绝时高亮被拒绝的那一步） */
const currentHighlightIndex = computed(() => {
  if (hasRejected.value && visibleApprovalStageCards.value.length > 0) {
    return visibleApprovalStageCards.value.length - 1
  }
  return currentStep.value
})

const approvalProjectName = computed(() =>
  release.value?.projectName || pipeline.value?.projectName || pipeline.value?.environment?.project?.name || '-'
)

const approvalEnvironmentName = computed(() =>
  release.value?.environmentName || pipeline.value?.environmentName || pipeline.value?.environment?.name || '-'
)

const handleReview = async (status: 'approved' | 'rejected') => {
  if (!pendingReview.value) return
  if (status === 'rejected' && !comment.value.trim()) {
    return message('拒绝时必须填写审批备注', { type: 'warning', duration: 5000 })
  }
  try {
    const targetReleaseId = releaseId.value ?? release.value?.id
    if (!targetReleaseId) return
    const response = await updateReview(getParams.projectId, getParams.environmentId, getParams.pipelineId, targetReleaseId, pendingReview.value.id, {
      status,
      comment: comment.value
    }) as ApiResponse
    if (response.success) {
      message(status === 'approved' ? '审批已通过' : '审批已拒绝', {
        type: status === 'approved' ? 'success' : 'error', duration: 5000
      })
      comment.value = ''
      await fetchReviews(getParams.projectId, getParams.environmentId, getParams.pipelineId, targetReleaseId)
      if (status === 'rejected' && release.value) {
        release.value = { ...release.value, approvalStatus: 'rejected' }
      }
      refresh()
    } else {
      message(response.msg || '审批失败', { type: 'error', duration: 5000 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : '操作失败')
    message(errorMessage, { type: 'error' })
  }
}

// 弹窗关闭
function onDialogClose() {
  comment.value = ''
}

onMounted(() => {
  useMultiTagsStoreHook().handleTags("push", {
    name: "DRGRelease",
    params: route.params,
    path: `/dragon/projects/:projectId/environments/:environmentId/pipelines/:pipelineId/releases`,
    meta: {
      title: "发布任务"
    }
  })
  fetchList(getPipeline, pipeline, getParams.projectId, getParams.environmentId, getParams.pipelineId)
  refresh()
})

// ------------------- 状态映射 -------------------
interface StatusItem { label: string, type: 'success' | 'warning' | 'danger' | 'info' }
const statusMap: Record<string, StatusItem> = {
  pending: { label: '等待发布', type: 'info' },
  progressing: { label: '正在发布', type: 'warning' },
  success: { label: '发布成功', type: 'success' },
  failed: { label: '发布失败', type: 'danger' },
}

/** 展示用发布状态：审批拒绝时优先显示「审批拒绝」，否则按 releaseStatus 映射 */
const getReleaseStatusDisplay = (row: { releaseStatus?: string; approvalStatus?: string } | null): StatusItem => {
  if (row?.approvalStatus === 'rejected') {
    return { label: '审批拒绝', type: 'danger' }
  }
  return statusMap[row?.releaseStatus ?? ''] ?? { label: '未知状态', type: 'info' }
}
</script>

<template>
  <div class="app-container">
    <div style="margin-bottom: 15px; font-size: 18px">
      <span class="card-title">项目名称 {{ pipeline?.projectName }} | 发布环境 {{ pipeline?.environmentName }} | 流水线 {{ pipeline?.name }}</span>
    </div>
    <div class="filter-container">
      <div style="min-width: 350px; float: right; margin-bottom: 10px">
        <el-input v-model="pagination.keyword" placeholder="输入关键字搜索"/>
      </div>
      <el-button type="primary" plain @click="addClick" class="release-publish-btn">
        <el-icon><Plus /></el-icon>
        <span>发 布</span>
      </el-button>
      <el-button type="info" plain @click="refreshClick" style="margin-left: 5px">
        <el-icon><Refresh /></el-icon>
        <span>刷 新</span>
      </el-button>
    </div>

    <el-table :data="data" stripe>
      <el-table-column prop="gitRef" label="分支/Tag">
        <template #default="{ row }">
          {{ row?.gitRef }} ({{row?.gitCommit}})
        </template>
      </el-table-column>
      <el-table-column prop="releaseStatus" label="发布状态">
        <template #default="{ row }">
          <el-tag :type="getReleaseStatusDisplay(row).type">
            {{ getReleaseStatusDisplay(row).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="持续时间">
        <template #default="scope">
          {{ formatDuration(scope.row.startedAt, scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="发布人员"></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="140">
        <template #default="scope">
          <el-button v-if="pipeline?.isApproval" link type="primary" size="small" @click="approvalClick(scope.row)">
            审核
          </el-button>
          <el-button link type="primary" size="small" @click="infoClick(scope.row.id)">
            详情
          </el-button>
          <el-button link type="primary" size="small">
            回滚
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

    <!-- 审批流程 -->
    <el-dialog
      title="审批流程"
      v-model="approvalDialogVisible"
      width="50%"
      @close="onDialogClose"
    >
      <el-descriptions>
      <el-descriptions-item label="项目名称">{{ approvalProjectName }}</el-descriptions-item>
      <el-descriptions-item label="项目环境">{{ approvalEnvironmentName }}</el-descriptions-item>
      <el-descriptions-item label="发布名称">{{ release?.pipelineName || pipeline?.name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="发布状态">
        <el-tag :type="getReleaseStatusDisplay(release).type">
          {{ getReleaseStatusDisplay(release).label }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="当前阶段">
        <el-tag :type="isSubmitStage ? 'info' : 'warning'">
          {{ currentStage }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="发起人员">{{ release.creator }}</el-descriptions-item>
      </el-descriptions>
      <!-- 方案 A：卡片式阶段条（拒绝后只显示到被拒绝步骤） -->
      <div class="approval-stage-cards">
        <div
          v-for="(item, index) in visibleApprovalStageCards"
          :key="index"
          class="approval-stage-card"
          :class="{ 'is-current': index === currentHighlightIndex }"
        >
          <div class="approval-stage-card__status" :class="'is-' + item.status">
            <el-icon v-if="item.status === 'success'"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="item.status === 'error'"><CircleCloseFilled /></el-icon>
            <el-icon v-else-if="item.status === 'process'"><Loading /></el-icon>
            <span v-else class="approval-stage-card__dot" />
          </div>
          <div class="approval-stage-card__body">
            <div class="approval-stage-card__title">{{ item.title }}</div>
            <div class="approval-stage-card__desc">{{ item.description }}</div>
          </div>
        </div>
      </div>

      <!-- 审批备注 -->
      <el-input
        type="textarea"
        v-model="comment"
        placeholder="请输入审批备注"
        style="margin-top: 15px;"
      />

      <!-- 操作按钮 -->
      <div style="text-align: right; margin-top: 10px;">
        <el-button
          type="danger"
          :disabled="!canApprove"
          @click="handleReview('rejected')"
        >
          拒绝
        </el-button>
        <el-button
          type="primary"
          :disabled="!canApprove"
          @click="handleReview('approved')"
        >
          通过
        </el-button>
      </div>
    </el-dialog>

    <!-- 表单操作 -->
    <el-dialog :title="textMap[dialogStatus]" v-model="dialogFormVisible" width="70%" @closed="handleDialogClosed">
      <el-form ref="dataFormRef" :model="dataForm" :rules="rules">
        <el-form-item label="GIT 分支" prop="gitRef" :label-width="formLabelWidth">
          <el-select v-model="dataForm.gitRef" filterable placeholder="选择分支 / Tag">
            <el-option-group label="Branches">
              <el-option
                v-for="b in branchOptions"
                :key="'b-' + b.RefName"
                :label="b.RefName"
                :value="b.RefName"
              />
            </el-option-group>

            <el-option-group label="Tags">
              <el-option
                v-for="t in tagOptions"
                :key="'t-' + t.RefName"
                :label="t.RefName"
                :value="t.RefName"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="发布描述" prop="description" :label-width="formLabelWidth">
          <el-input v-model="dataForm.description"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogFormVisible = false">取 消</el-button>
          <el-button type="primary" @click="createForm(dataFormRef)">
            确 认
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 发布详情 -->
    <el-dialog title="发布详情" v-model="dialogInfoVisible" width="70%">
      <el-tabs type="border-card" v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="日志" name="log" lazy>
          <div class="log-container" ref="logContainer">
            <div v-for="(line, index) in logs" :key="index" class="log-line" v-html="line">
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="详情" name="info" lazy>
          <el-descriptions :column="2">
            <el-descriptions-item label="项目名称">{{ release?.projectName }}</el-descriptions-item>
            <el-descriptions-item label="发布环境">{{ release?.environmentName }}</el-descriptions-item>
            <el-descriptions-item label="发布名称">{{ release?.pipelineName }}</el-descriptions-item>
            <el-descriptions-item label="分支/Tag">{{ release?.gitRef }} ({{release?.gitCommit}})</el-descriptions-item>
            <el-descriptions-item label="发布任务">{{ release?.taskID }}</el-descriptions-item>
            <el-descriptions-item label="镜像仓库">{{ release?.imageRegistry }}</el-descriptions-item>
            <el-descriptions-item label="镜像名称">{{ release?.imageName }}</el-descriptions-item>
            <el-descriptions-item label="镜像版本">{{ release?.imageTag }}</el-descriptions-item>
            <el-descriptions-item label="发布状态">
              <el-tag :type="getReleaseStatusDisplay(release).type">
                {{ getReleaseStatusDisplay(release).label }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="启用审核">
              <el-tag :type="pipeline?.isApproval ? 'success' : 'info'">
                {{ pipeline?.isApproval ? '已启用' : '未启用' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="发布人员">{{ release?.creator }}</el-descriptions-item>
            <el-descriptions-item label="发布描述">{{ release?.description || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ formatDate(release?.startedAt) }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ formatDate(release?.finishedAt) }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

  </div>
</template>

<style scoped lang="scss">
.release-context-alert {
  margin-bottom: 10px;
  padding-left: 0;
  padding-right: 0;
}

.release-context-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.release-context-label {
  color: #606266;
}

.release-context-value {
  font-weight: 500;
}

.release-context-alert :deep(.el-alert__content),
.release-context-alert :deep(.el-alert__description),
.release-context-alert :deep(.el-alert__title) {
  font-size: 16px !important;
  font-weight: 600;
  padding-left: 0;
}

.release-publish-btn {
  margin-left: 0;
}

.release-context-sep {
  margin: 0 8px;
  color: #c0c4cc;
}
/* 内层日志滚动区 */
.log-container {
  background-color: #111;   /* 稍浅黑，区分边界 */
  color: #fff;
  font-family: monospace;
  padding: 10px;
  height: 500px;
  overflow-y: auto;
  overflow-x: auto;
  white-space: nowrap;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px #333; /* 内阴影模拟边框，柔和 */

  /* Firefox 滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #555 #222;
}

/* Chrome/Safari/Edge 滚动条 */
.log-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-track {
  background: #222;
}

/* 每行日志 */
.log-line {
  white-space: nowrap;   /* 保持不换行 */
}

/* 方案 A：卡片式阶段条 */
.approval-stage-cards {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.approval-stage-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #f8fafc;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.approval-stage-card.is-current {
  border-color: #e6a23c;
  box-shadow: 0 0 0 1px #e6a23c;
  background: #fdf6ec;
}

.approval-stage-card__status {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 18px;
}

.approval-stage-card__status.is-success {
  color: #67c23a;
}

.approval-stage-card__status.is-error {
  color: #f56c6c;
}

.approval-stage-card__status.is-process {
  color: #e6a23c;
}

.approval-stage-card__status.is-wait .approval-stage-card__dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  background: #fff;
}

.approval-stage-card__body {
  flex: 1;
  min-width: 0;
}

.approval-stage-card__title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.approval-stage-card.is-current .approval-stage-card__title {
  color: #e6a23c;
}

.approval-stage-card__desc {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  white-space: pre-line;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  background: #fff;
}

</style>
