export default {
  path: "/authn",
  redirect: "/authn/users",
  meta: {
    title: "用户管理",
    icon: "ri/user-line",
    rank: 4
  },
  children: [
    {
      path: "/authn/users",
      name: "AuthnUser",
      component: () => import("@/views/authn/users/index.vue"),
      meta: {
        title: "用户管理",
        showParent: true,
        icon: "ri/user-line",
        requireSuperuser: true
      }
    }
  ]
} satisfies RouteConfigsTable;
