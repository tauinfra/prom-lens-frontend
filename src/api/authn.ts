import { http } from "@/utils/http";
import { authnUrlApi } from "./utils";
import type { PaginationParams } from "./types";

/** 获取用户列表 */
export const getUsers = (params: PaginationParams) => {
  return http.request("get", authnUrlApi("users"), { params });
};

/** 查看用户 */
export const getUser = (userId: number) => {
  return http.request("get", authnUrlApi(`users/${userId}`));
};

/** 创建用户 */
export const createUser = (data: object) => {
  return http.request("post", authnUrlApi("users"), { data });
};

/** 更新用户 */
export const updateUser = (userId: number, data: object) => {
  return http.request("patch", authnUrlApi(`users/${userId}`), { data });
};

/** 删除用户 */
export const deleteUser = (userId: number) => {
  return http.request("delete", authnUrlApi(`users/${userId}`));
};

/** 当前用户账号信息（/api/v1/authn/me/profile） */
export interface MeProfile {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  lastLogin?: string;
  roles?: string[];
  permissions?: string[];
}

export const getProfile = () => {
  return http.request<{ data: MeProfile }>("get", authnUrlApi("me/profile"));
};

/** 当前用户按钮级权限（GET /api/v1/authn/me/permissions） */
export type MePermissionsResponse = {
  success: boolean;
  code?: number;
  data?: { permissions: string[] };
  msg?: string;
};

export const getMePermissions = () => {
  return http.request<MePermissionsResponse>(
    "get",
    authnUrlApi("me/permissions")
  );
};

/** 更新当前用户资料（邮箱、手机号等） */
export const updateProfile = (data: { email?: string; phone?: string }) => {
  return http.request("patch", authnUrlApi("me/profile"), { data });
};

/** 更新密码 */
export const userChangePassword = (data: object) => {
  return http.request("post", authnUrlApi("me/change-password"), { data });
};

/** 重置密码 */
export const userResetPassword = (userId: number, data: object) => {
  return http.request("post", authnUrlApi(`users/${userId}/reset-password`), {
    data
  });
};
