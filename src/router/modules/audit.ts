export default {
  path: "/audit",
  meta: {
    title: "审计管理",
    icon: "ri/file-search-line",
    rank: 3
  },
  children: [
    {
      path: "/audit/auth-logs",
      name: "AuthLog",
      component: () => import("@/views/audit/authlog/index.vue"),
      meta: {
        title: "登录日志",
        showParent: true,
        icon: "ri/login-box-line"
      }
    },
    {
      path: "/audit/logs",
      name: "AuditLog",
      component: () => import("@/views/audit/log/index.vue"),
      meta: {
        title: "操作日志",
        showParent: true,
        icon: "ri/clipboard-line"
      }
    }
  ]
} satisfies RouteConfigsTable;
