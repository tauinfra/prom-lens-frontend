import { http } from "@/utils/http";
import {authnUrlApi } from "./utils";
import type { PaginationParams } from './types'

/** 获取角色列表 */
export const getRoles = (params: PaginationParams) => {
  return http.request("get", authnUrlApi("roles"), { params });
};

/** 查看角色权限列表 */
export const getRolePermissions = (roleId: number) => {
  return http.request("get", authnUrlApi(`roles/${roleId}/permissions`), );
};

/** 查看角色 */
export const getRole = (roleId: number) => {
  return http.request("get", authnUrlApi(`roles/${roleId}`), );
};

/** 创建角色 */
export const createRole = (data: object) => {
  return http.request("post", authnUrlApi("roles"), { data });
};

/** 更新角色 */
export const updateRole = (roleId: number, data: object) => {
  return http.request("patch", authnUrlApi(`roles/${roleId}`), { data });
};

/** 更新角色权限 */
export const updateRolePermissions = (roleId: number, data: object) => {
  return http.request("patch", authnUrlApi(`roles/${roleId}/permissions`), { data });
};

/** 删除角色 */
export const deleteRole = (roleId: number) => {
  return http.request("delete", authnUrlApi(`roles/${roleId}`));
};

/** 获取权限列表 */
export const getPermissions = (params: PaginationParams) => {
  return http.request("get", authnUrlApi("permissions"), { params });
};

/** 查看权限 */
export const getPermission = (permissionId: number) => {
  return http.request("get", authnUrlApi(`permissions/${permissionId}`), );
};

/** 创建权限 */
export const createPermission = (data: object) => {
  return http.request("post", authnUrlApi("permissions"), { data });
};

/** 更新权限 */
export const updatePermission = (permissionId: number, data: object) => {
  return http.request("patch", authnUrlApi(`permissions/${permissionId}`), { data });
};

/** 删除权限 */
export const deletePermission = (permissionId: number) => {
  return http.request("delete", authnUrlApi(`permissions/${permissionId}`));
};

/** 获取菜单列表 */
export const getMenus = (params: PaginationParams) => {
  return http.request("get", authnUrlApi("menus"), { params });
};

/** 查看菜单 */
export const getMenu = (menuId: number) => {
  return http.request("get", authnUrlApi(`menus/${menuId}`), );
};

/** 创建菜单 */
export const createMenu = (data: object) => {
  return http.request("post", authnUrlApi("menus"), { data });
};

/** 更新菜单 */
export const updateMenu = (menuId: number, data: object) => {
  return http.request("patch", authnUrlApi(`menus/${menuId}`), { data });
};

/** 删除菜单 */
export const deleteMenu = (menuId: number) => {
  return http.request("delete", authnUrlApi(`menus/${menuId}`));
};

/** 获取用户列表 */
export const getUsers = (params: PaginationParams) => {
  return http.request("get", authnUrlApi("users"), { params });
};

/** 获取用户角色列表 */
export const getUserRoles = (id: number, params?: PaginationParams) => {
  return http.request("get", authnUrlApi(`users/${id}/roles`), { params });
};

/** 更新用户角色列表 */
export const updateUserRoles = (id: number, data: object) => {
  return http.request("patch", authnUrlApi(`users/${id}/roles`), { data });
};

/** 获取用户菜单列表 */
export const getUserMenus = (id: number, params?: PaginationParams) => {
  return http.request("get", authnUrlApi(`users/${id}/menus`), { params });
};

/** 更新用户菜单列表 */
export const updateUserMenus = (id: number, data: object) => {
  return http.request("patch", authnUrlApi(`users/${id}/menus`), { data });
};

/** 查看用户 */
export const getUser = (userId: number) => {
  return http.request("get", authnUrlApi(`users/${userId}`), );
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
  return http.request("post", authnUrlApi(`users/${userId}/reset-password`), { data });
};
