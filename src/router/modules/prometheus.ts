import { PROM_GROUP_TYPES } from "@/views/prometheus/constants";

export default {
  path: "/prometheus",
  meta: {
    title: "Prometheus",
    icon: "logos/prometheus",
    rank: 1
  },
  children: [
    {
      path: "/prometheus/alerting-groups",
      name: "PromAlertingGroup",
      component: () => import("@/views/prometheus/group/index.vue"),
      meta: {
        title: "告警规则组",
        showParent: true,
        icon: "ri/alarm-warning-line",
        groupType: PROM_GROUP_TYPES.ALERTING
      }
    },
    {
      path: "/prometheus/alerting-groups/:id/rules",
      name: "PromAlertRule",
      component: () => import("@/views/prometheus/rule/index.vue"),
      meta: {
        title: "告警规则",
        showLink: false,
        showParent: true,
        groupType: PROM_GROUP_TYPES.ALERTING
      }
    },
    {
      path: "/prometheus/recording-groups",
      name: "PromRecordingGroup",
      component: () => import("@/views/prometheus/group/index.vue"),
      meta: {
        title: "聚合规则组",
        showParent: true,
        icon: "ri/bar-chart-grouped-line",
        groupType: PROM_GROUP_TYPES.RECORDING
      }
    },
    {
      path: "/prometheus/recording-groups/:id/records",
      name: "PromRecord",
      component: () => import("@/views/prometheus/rule/index.vue"),
      meta: {
        title: "聚合规则",
        showLink: false,
        showParent: true,
        groupType: PROM_GROUP_TYPES.RECORDING
      }
    }
  ]
} satisfies RouteConfigsTable;
