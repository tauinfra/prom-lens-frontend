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
export const getGroups = (params: PaginationParams & { type?: string }) => {
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
export const getRules = (
  groupId: string | string[],
  params: PaginationParams
) => {
  return http.request("get", promUrlApi(`groups/${groupId}/rules`), { params });
};

/** 创建规则 */
export const createRule = (groupId: string | string[], data: object) => {
  return http.request("post", promUrlApi(`groups/${groupId}/rules`), { data });
};

/** 更新规则 */
export const updateRule = (
  groupId: string | string[],
  id: number,
  data: object
) => {
  return http.request("patch", promUrlApi(`groups/${groupId}/rules/${id}`), {
    data
  });
};

/** 删除规则 */
export const deleteRule = (groupId: string | string[], id: number) => {
  return http.request("delete", promUrlApi(`groups/${groupId}/rules/${id}`));
};

/** 查询聚合规则列表 */
export const getRecords = (
  groupId: string | string[],
  params: PaginationParams
) => {
  return http.request("get", promUrlApi(`groups/${groupId}/records`), {
    params
  });
};

/** 创建聚合规则 */
export const createRecord = (groupId: string | string[], data: object) => {
  return http.request("post", promUrlApi(`groups/${groupId}/records`), {
    data
  });
};

/** 更新聚合规则 */
export const updateRecord = (
  groupId: string | string[],
  id: number,
  data: object
) => {
  return http.request("patch", promUrlApi(`groups/${groupId}/records/${id}`), {
    data
  });
};

/** 删除聚合规则 */
export const deleteRecord = (groupId: string | string[], id: number) => {
  return http.request("delete", promUrlApi(`groups/${groupId}/records/${id}`));
};

/** 查询采集目标组列表 */
export const getTargetGroups = (params: PaginationParams) => {
  return http.request("get", promUrlApi("target-groups"), { params });
};

/** 查询采集目标组 */
export const getTargetGroup = (id: number) => {
  return http.request("get", promUrlApi(`target-groups/${id}`));
};

/** 创建采集目标组 */
export const createTargetGroup = (data: object) => {
  return http.request("post", promUrlApi("target-groups"), { data });
};

/** 更新采集目标组 */
export const updateTargetGroup = (id: number, data: object) => {
  return http.request("patch", promUrlApi(`target-groups/${id}`), { data });
};

/** 删除采集目标组 */
export const deleteTargetGroup = (id: number) => {
  return http.request("delete", promUrlApi(`target-groups/${id}`));
};

/** 查询采集目标列表 */
export const getTargets = (
  groupId: string | string[],
  params: PaginationParams
) => {
  return http.request("get", promUrlApi(`target-groups/${groupId}/targets`), {
    params
  });
};

/** 创建采集目标 */
export const createTarget = (groupId: string | string[], data: object) => {
  return http.request("post", promUrlApi(`target-groups/${groupId}/targets`), {
    data
  });
};

/** 更新采集目标 */
export const updateTarget = (
  groupId: string | string[],
  id: number,
  data: object
) => {
  return http.request(
    "patch",
    promUrlApi(`target-groups/${groupId}/targets/${id}`),
    { data }
  );
};

/** 删除采集目标 */
export const deleteTarget = (groupId: string | string[], id: number) => {
  return http.request(
    "delete",
    promUrlApi(`target-groups/${groupId}/targets/${id}`)
  );
};
