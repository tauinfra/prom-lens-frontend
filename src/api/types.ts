// 类型定义
export interface PaginationParams {
  page: number;
  size: number;
  sortBy?: string; // 可选排序字段
  sortOrder?: string; // 排序方式
  keyword?: string; // 搜索关键字
}

export type UserResult = {
  success: boolean;
  msg?: string;
  data: {
    /** 用户 ID */
    uid?: number;
    /** 头像 */
    avatar?: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname?: string;
    /** 当前登录用户的角色 */
    roles?: Array<string>;
    /** 按钮级别权限 */
    permissions?: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date | string;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  msg?: string;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};
