export default {
  path: "/alerting",
  redirect: "/alerting/webhooks",
  meta: {
    title: "告警通知",
    icon: "ri/notification-3-line",
    rank: 2
  },
  children: [
    {
      path: "/alerting/webhooks",
      name: "AlertingWebhook",
      component: () => import("@/views/alerting/webhooks/index.vue"),
      meta: {
        title: "通道列表",
        showParent: true,
        icon: "ri/link"
      }
    }
  ]
} satisfies RouteConfigsTable;
