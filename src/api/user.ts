import { http } from "@/utils/http";
import { authnUrlApi } from "./utils";
import type { UserResult, RefreshTokenResult } from './types'


/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<UserResult>("post", authnUrlApi("login"), { data });
};

/** 刷新`token` */
export const refreshTokenApi = (refreshToken: string) => {
  return http.request<RefreshTokenResult>("post", authnUrlApi("refresh-token"), {
    headers: {
      Authorization: `Bearer ${refreshToken}`
    }
  });
};
