const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/prometheus/alerting-groups",
  meta: {
    title: "Prometheus",
    showLink: false,
    rank: 0
  },
  children: []
} satisfies RouteConfigsTable;
