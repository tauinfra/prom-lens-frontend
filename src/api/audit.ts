import { http } from "@/utils/http";
import {auditUrlApi, } from "./utils";
import type { PaginationParams } from './types'


/** 获取登录日志 */
export const getAuthLogs = (params: PaginationParams) => {
  return http.request("get", auditUrlApi("auth-logs"), { params });
};

/** 获取资源列表 */
export const getAuditLogs = (params: PaginationParams) => {
  return http.request("get", auditUrlApi("logs"), { params });
};
