// import IconShieldCogOutline from '~icons/mdi/cog-outline'
// import IconUser from '~icons/mdi/user'
// import IconAccountGroup from '~icons/mdi/account-group'
// import IconKeyVariant from '~icons/mdi/key-variant'
// import IconMenu from '~icons/mdi/menu'
//
// export default {
//   path: "/authn",
//   meta: {
//     title: "认证管理",
//     icon: IconShieldCogOutline,
//   },
//   children: [
//     {
//       path: "/authn/users",
//       name: "AuthnUser",
//       component: () => import("@/views/authn/user/index.vue"),
//       meta: {
//         title: "用户管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconUser,
//         roles: ["admin", "authn:user:view"]
//       }
//     },
//     {
//       path: "/authn/roles",
//       name: "AuthnRole",
//       component: () => import("@/views/authn/role/index.vue"),
//       meta: {
//         title: "角色管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconAccountGroup,
//         roles: ["admin", "authn:role:view"]
//       }
//     },
//     {
//       path: "/authn/permissions",
//       name: "AuthnPermission",
//       component: () => import("@/views/authn/permission/index.vue"),
//       meta: {
//         title: "权限管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconKeyVariant,
//         roles: ["admin", "authn:permission:view"]
//       }
//     },
//     {
//       path: "/authn/menus",
//       name: "AuthnMenu",
//       component: () => import("@/views/authn/menu/index.vue"),
//       meta: {
//         title: "菜单管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconMenu,
//         roles: ["admin", "authn:menu:view"]
//       }
//     },
//   ]
// }
