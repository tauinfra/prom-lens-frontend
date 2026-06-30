import { http } from "@/utils/http";
import { alertingUrlApi } from "./utils";
import type { PaginationParams } from "./types";

/** 查询 Webhook 通道列表 */
export const getWebhooks = (params: PaginationParams) => {
  return http.request("get", alertingUrlApi("webhooks"), { params });
};

/** 创建 Webhook 通道 */
export const createWebhook = (data: object) => {
  return http.request("post", alertingUrlApi("webhooks"), { data });
};

/** 更新 Webhook 通道 */
export const updateWebhook = (id: number, data: object) => {
  return http.request("patch", alertingUrlApi(`webhooks/${id}`), { data });
};

/** 删除 Webhook 通道 */
export const deleteWebhook = (id: number) => {
  return http.request("delete", alertingUrlApi(`webhooks/${id}`));
};

/** 验证通道地址并发送测试消息 */
export const verifyWebhook = (data: { url: string }) => {
  return http.request("post", alertingUrlApi("webhooks/verify"), { data });
};
