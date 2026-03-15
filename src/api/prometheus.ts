import { http } from "@/utils/http";
import { promUrlApi } from "./utils";

// 类型定义
export interface PaginationParams {
  page: number;
  size: number;
  sortBy?: string; // 可选排序字段
  sortOrder?: string; // 排序方式
  keyword?: string; // 搜索关键字
}

/** 查询规则组列表 */
export const getGroups = (params: PaginationParams) => {
  return http.request("get", promUrlApi("groups"), { params });
};

/** 查询规则组 */
export const getGroup = (id: number) => {
  return http.request("get", promUrlApi(`groups/${id}`));
};

/** 创建规则组 */
export const createGroup = (data: object) => {
  return http.request("post", promUrlApi("groups"), { data });
};

/** 更新规则组 */
export const updateGroup = (id: number, data: object) => {
  return http.request("patch", promUrlApi(`groups/${id}`), { data });
};

/** 删除规则组 */
export const deleteGroup = (id: number) => {
  return http.request("delete", promUrlApi(`groups/${id}`));
};

/** 查询规则列表 */
export const getRules = (groupId: string | string [], params: PaginationParams) => {
  return http.request("get", promUrlApi(`groups/${groupId}/rules`), { params });
};

/** 创建规则 */
export const createRule = (groupId: string | string[], data: object) => {
  return http.request("post", promUrlApi(`groups/${groupId}/rules`), { data });
};

/** 更新规则 */
export const updateRule = (groupId: string | string[], id: number, data: object) => {
  return http.request("patch", promUrlApi(`groups/${groupId}/rules/${id}`), { data });
};

/** 删除规则 */
export const deleteRule = (groupId: string | string[], id: number) => {
  return http.request("delete", promUrlApi(`groups/${groupId}/rules/${id}`));
};

/** 查询 Target Group 列表 */
export const getTargetGroups = (params: PaginationParams) => {
  return http.request("get", promUrlApi("target-groups"), { params });
};

/** 查询 Target Group */
export const getTargetGroup = (id: number) => {
  return http.request("get", promUrlApi(`target-groups/${id}`));
};

/** 创建 Target Group */
export const createTargetGroup = (data: object) => {
  return http.request("post", promUrlApi("target-groups"), { data });
};

/** 更新 Target Group */
export const updateTargetGroup = (id: number, data: object) => {
  return http.request("patch", promUrlApi(`target-groups/${id}`), { data });
};

/** 删除 Target Group */
export const deleteTargetGroup = (id: number) => {
  return http.request("delete", promUrlApi(`target-groups/${id}`));
};

/** 查询 Target 列表 */
export const getTargets = (groupId: string | string[], params: PaginationParams) => {
  return http.request("get", promUrlApi(`target-groups/${groupId}/targets`), { params });
};

/** 创建 Target */
export const createTarget = (groupId: string | string[], data: object) => {
  return http.request("post", promUrlApi(`target-groups/${groupId}/targets`), { data });
};

/** 更新 Target */
export const updateTarget = (groupId: string | string[], id: number, data: object) => {
  return http.request("patch", promUrlApi(`target-groups/${groupId}/targets/${id}`), { data });
};

/** 删除 Target */
export const deleteTarget = (groupId: string | string[], id: number) => {
  return http.request("delete", promUrlApi(`target-groups/${groupId}/targets/${id}`));
};
