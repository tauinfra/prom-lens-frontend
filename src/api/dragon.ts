import { http } from "@/utils/http";
import { dragonUrlApi } from "./utils";
import type { PaginationParams } from './types'

/** 查询凭证列表 */
export const getCredentials = (params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`credentials`), { params });
};

/** 查询凭证 */
export const getCredential = (id: number) => {
  return http.request("get", dragonUrlApi(`credentials/${id}`));
};

/** 创建凭证 */
export const createCredential = (data: object) => {
  return http.request("post", dragonUrlApi(`credentials`), { data });
};

/** 更新凭证 */
export const updateCredential = (id: number, data: object) => {
  return http.request("patch", dragonUrlApi(`credentials/${id}`), { data });
};

/** 删除凭证 */
export const deleteCredential = (id: number) => {
  return http.request("delete", dragonUrlApi(`credentials/${id}`));
};

/** 查询项目列表 */
export const getProjects = (params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects`), { params });
};

/** 创建项目 */
export const createProject = (data: object) => {
  return http.request("post", dragonUrlApi(`projects`), { data });
};

/** 更新项目 */
export const updateProject = (id: number, data: object) => {
  return http.request("patch", dragonUrlApi(`projects/${id}`), { data });
};

/** 删除项目 */
export const deleteProject = (id: number) => {
  return http.request("delete", dragonUrlApi(`projects/${id}`));
};

/** 查询环境列表 */
export const getEnvironments = (projectId: number, params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments`), { params });
};

/** 查询环境 */
export const getEnvironment = (projectId, environmentId: number) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}`));
};

/** 创建环境 */
export const createEnvironment = (projectId: number, data: object) => {
  return http.request("post", dragonUrlApi(`projects/${projectId}/environments`), { data });
};

/** 更新环境 */
export const updateEnvironment = (projectId, environmentId: number, data: object) => {
  return http.request("patch", dragonUrlApi(`projects/${projectId}/environments/${environmentId}`), { data });
};

/** 删除环境 */
export const deleteEnvironment = (projectId, environmentId: number) => {
  return http.request("delete", dragonUrlApi(`projects/${projectId}/environments/${environmentId}`));
};

/** 查询管道列表 */
export const getPipelines = (projectId, environmentId: number, params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines`), { params });
};

/** 查询管道 */
export const getPipeline = (projectId, environmentId, pipelineId: number) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}`));
};

/** 创建管道 */
export const createPipeline = (projectId, environmentId: number, data: object) => {
  return http.request("post", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines`), { data });
};

/** 更新管道 */
export const updatePipeline = (projectId, environmentId, pipelineId: number, data: object) => {
  return http.request("patch", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}`), { data });
};

/** 删除管道 */
export const deletePipeline = (projectId, environmentId, pipelineId: number) => {
  return http.request("delete", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}`));
};



/** 获取发布任务列表 */
export const getReleases = (projectId, environmentId, pipelineId: number, params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/releases`), { params });
};

/** 查询发布任务 */
export const getRelease = (projectId, environmentId, pipelineId, releaseId: number) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/releases/${releaseId}`));
};

/** 创建发布任务 */
export const createRelease = (projectId, environmentId, pipelineId: number, data: object) => {
  return http.request("post", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/releases`), { data });
};

/** 批量新增管道授权 */
export const createPipelineAclBatch = (projectId, environmentId, pipelineId: number, data: object) => {
  return http.request("post", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/acls/batch`), { data });
};

/** 获取管道授权列表 */
export const getPipelineAcls = (projectId, environmentId, pipelineId: number, params?: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/acls`), { params });
};

/** 删除管道授权 */
export const deletePipelineAcl = (projectId, environmentId, pipelineId, aclId: number) => {
  return http.request("delete", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/acls/${aclId}`));
};

/** 获取审核列表 */
export const getReviews = (projectId, environmentId, pipelineId, releaseId: number, params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/releases/${releaseId}/reviews`), { params });
};

/** 查询审核 */
export const getReview = (projectId, environmentId, pipelineId, releaseId, reviewId: number, params: PaginationParams) => {
  return http.request("get", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/releases/${releaseId}/reviews/${reviewId}`), { params });
};

/** 更新审核 */
export const updateReview = (projectId, environmentId, pipelineId, releaseId, reviewId: number, data: object) => {
  return http.request("patch", dragonUrlApi(`projects/${projectId}/environments/${environmentId}/pipelines/${pipelineId}/releases/${releaseId}/reviews/${reviewId}`), { data });
};

/** 获取 Gitlab Group 列表 */
export const getGitlabGroups = (id: number) => {
  return http.request("get", dragonUrlApi(`gitlab/${id}/groups`));
};

/** 获取 Gitlab Group 列表 */
export const getGitlabProjects = (id, groupId: number) => {
  return http.request("get", dragonUrlApi(`gitlab/${id}/groups/${groupId}/projects`));
};

/** 获取 Gitlab Tags 列表 */
export const getGitlabTags = (id, projectId: number) => {
  return http.request("get", dragonUrlApi(`gitlab/${id}/projects/${projectId}/tags`));
};

/** 获取 Gitlab Branch 列表 */
export const getGitlabBranches = (id, projectId: number) => {
  return http.request("get", dragonUrlApi(`gitlab/${id}/projects/${projectId}/branches`));
};

/** 查询 Tekton Pipeline 列表 */
export const getTektonPipelines = (params?: PaginationParams) => {
  return http.request("get", dragonUrlApi(`tekton/pipelines`), { params });
};

/** 查询 Tekton Pipeline */
export const getTektonPipeline = (name: string) => {
  return http.request("get", dragonUrlApi(`tekton/pipelines/${name}`));
};

/** 创建 Tekton Pipeline */
export const createTektonPipeline = (data: object) => {
  return http.request("post", dragonUrlApi(`tekton/pipelines`), { data });
};

/** 更新 Tekton Pipeline */
export const updateTektonPipeline = (name: string, data: object) => {
  return http.request("patch", dragonUrlApi(`tekton/pipelines/${name}`), { data });
};

/** 删除 Tekton Pipeline */
export const deleteTektonPipeline = (name: string) => {
  return http.request("delete", dragonUrlApi(`tekton/pipelines/${name}`));
};

/** 查询 Tekton Task 列表 */
export const getTektonTasks = (params?: PaginationParams) => {
  return http.request("get", dragonUrlApi(`tekton/tasks`), { params });
};

/** 查询 Tekton Task */
export const getTektonTask = (name: string) => {
  return http.request("get", dragonUrlApi(`tekton/tasks/${name}`));
};

/** 创建 Tekton Task */
export const createTektonTask = (data: object) => {
  return http.request("post", dragonUrlApi(`tekton/tasks`), { data });
};

/** 更新 Tekton Task */
export const updateTektonTask = (name: string, data: object) => {
  return http.request("patch", dragonUrlApi(`tekton/tasks/${name}`), { data });
};

/** 删除 Tekton Task */
export const deleteTektonTask = (name: string) => {
  return http.request("delete", dragonUrlApi(`tekton/tasks/${name}`));
};

/** 查询 Tekton TaskRun 列表 */
export const getTektonTaskRuns = (params?: PaginationParams) => {
  return http.request("get", dragonUrlApi(`tekton/taskruns`), { params });
};

/** 查询 Tekton TaskRun */
export const getTektonTaskRun = (name: string) => {
  return http.request("get", dragonUrlApi(`tekton/taskruns/${name}`));
};

/** 创建 Tekton TaskRun */
export const createTektonTaskRun = (data: object) => {
  return http.request("post", dragonUrlApi(`tekton/taskruns`), { data });
};

/** 更新 Tekton TaskRun */
export const updateTektonTaskRun = (name: string, data: object) => {
  return http.request("patch", dragonUrlApi(`tekton/taskruns/${name}`), { data });
};

/** 删除 Tekton TaskRun */
export const deleteTektonTaskRun = (name: string) => {
  return http.request("delete", dragonUrlApi(`tekton/taskruns/${name}`));
};

/** 批量删除 Tekton TaskRun */
export const deleteTektonTaskRuns = (names: string[]) => {
  return http.request("post", dragonUrlApi(`tekton/taskruns/batch-delete`), {
    data: { names }
  });
};

/** 查询 Tekton PipelineRun 列表 */
export const getTektonPipelineRuns = (params?: PaginationParams) => {
  return http.request("get", dragonUrlApi(`tekton/pipelineruns`), { params });
};

/** 查询 Tekton PipelineRun */
export const getTektonPipelineRun = (name: string) => {
  return http.request("get", dragonUrlApi(`tekton/pipelineruns/${name}`));
};

/** 创建 Tekton PipelineRun */
export const createTektonPipelineRun = (data: object) => {
  return http.request("post", dragonUrlApi(`tekton/pipelineruns`), { data });
};

/** 更新 Tekton PipelineRun */
export const updateTektonPipelineRun = (name: string, data: object) => {
  return http.request("patch", dragonUrlApi(`tekton/pipelineruns/${name}`), { data });
};

/** 删除 Tekton PipelineRun */
export const deleteTektonPipelineRun = (name: string) => {
  return http.request("delete", dragonUrlApi(`tekton/pipelineruns/${name}`));
};

/** 批量删除 Tekton PipelineRun */
export const deleteTektonPipelineRuns = (names: string[]) => {
  return http.request("post", dragonUrlApi(`tekton/pipelineruns/batch-delete`), {
    data: { names }
  });
};

/** 发布统计报表汇总 */
export const getReportSummary = () => {
  return http.request("get", dragonUrlApi(`reports/summary`));
};

/** Dashboard 集群信息（data.cluster） */
export interface DashboardCluster {
  clusters: number
  nodes: number
  namespaces: number
  pods: number
}

/** Dashboard 应用发布（data.pipelines） */
export interface DashboardPipelines {
  today_total: number
  success: number
  failed: number
  rollback: number
}

export interface DashboardData {
  cluster: DashboardCluster
  resources?: Record<string, unknown>
  pipelines?: DashboardPipelines
}

export const getDashboard = () => {
  return http.request<{ data: DashboardData }>("get", "/api/v1/dashboard");
};

/** 发布趋势点（按小时：hour 可为 string 或 number；按日：date），数量字段兼容 snake_case */
export interface PipelinesTrendPoint {
  hour?: string | number
  date?: string
  success_count?: number
  failed_count?: number
  rollback_count?: number
  success?: number
  failed?: number
  rollback?: number
}

export const getPipelinesTrend = (params?: { range?: 'today' | '7d' | '30d' }) => {
  return http.request<{ data: PipelinesTrendPoint[] }>("get", "/api/v1/dashboard/pipelines/trend", { params });
};

/** 最近发布记录项（与后端返回一致） */
export interface RecentReleaseItem {
  projectName: string
  pipeline: string
  status: string
  duration: number
  time: string
}

export const getRecentReleases = (params?: { env?: string; limit?: number }) => {
  return http.request<{ code?: number; data: RecentReleaseItem[]; success?: boolean }>("get", "/api/v1/dashboard/pipelines/recent", { params: { env: 'prod', limit: 10, ...params } });
};

/** 项目统计项（与后端 /api/v1/dashboard/pipelines/projects 返回一致） */
export interface PipelineProjectItem {
  projectName: string
  pipelineCount: number
  releaseCount: number
  successCount: number
  failedCount: number
  rollbackCount: number
}

export const getPipelineProjects = () => {
  return http.request<{ code?: number; data: PipelineProjectItem[]; success?: boolean }>("get", "/api/v1/dashboard/pipelines/projects");
};
