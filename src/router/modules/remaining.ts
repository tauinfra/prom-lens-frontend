const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: "登录",
      showLink: false,
      rank: 101
    }
  },
  {
    path: "/redirect",
    component: Layout,
    meta: {
      title: "加载中...",
      showLink: false,
      rank: 102
    },
    children: [
      {
        path: "/redirect/:path(.*)",
        name: "Redirect",
        component: () => import("@/layout/redirect.vue")
      }
    ]
  },
  {
    path: "/kubernetes/clusters/:id/namespaces/:ns/pods/:name/containers/:container/terminal",
    name: "PodTerminal",
    component: () => import("@/views/kubernetes/workload/pod/components/terminal.vue"),
    meta: {
      title: "Pod 终端",
      showLink: false,
      rank: 103
    }
  },
  {
    path: "/personal",
    component: Layout,
    meta: { title: "个人中心", showLink: false, rank: 104 },
    children: [
      {
        path: "profile",
        name: "PersonalProfile",
        component: () => import("@/views/personal/profile.vue"),
        meta: { title: "账号管理", showLink: false }
      },
      {
        path: "change-password",
        name: "PersonalChangePassword",
        component: () => import("@/views/personal/change-password.vue"),
        meta: { title: "修改密码", showLink: false }
      }
    ]
  },
] satisfies Array<RouteConfigsTable>;
