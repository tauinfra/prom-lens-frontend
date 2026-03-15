// import IconKubernetes from '~icons/cib/kubernetes'
// import IconGitPod from '~icons/cib/gitpod'
// import IconCluster from '~icons/carbon/cloud-app'
// import IconLayersOutline from '~icons/material-symbols/layers-outline'
// import IconServerOutline from '~icons/mdi/server-outline'
// import IconLockCheckOutline from '~icons/mdi/lock-check-outline'
// import IconConfigSolid from '~icons/mynaui/config-solid'
// import IconLoadBalancerPool from '~icons/carbon/load-balancer-pool'
// import IconStorage from '~icons/mdi/storage'
//
// export default {
//   path: "/kubernetes",
//   meta: {
//     title: "Kubernetes",
//     icon: "mdi:kubernetes",
//     rank: 1,
//     roles: ["admin"]
//   },
//   children: [
//     {
//       path: "/kubernetes/clusters",
//       name: "Cluster",
//       component: () => import("@/views/kubernetes/cluster/index.vue"),
//       meta: {
//         title: "集群管理",
//         icon: IconCluster,
//         showParent: true,
//         // 是否显示该菜单
//         showLink: true,
//         roles: ["admin"]
//       }
//     },
//     {
//       path: "/kubernetes/nodes",
//       name: "Node",
//       component: () => import("@/views/kubernetes/node/index.vue"),
//       meta: {
//         title: "节点管理",
//         icon: IconServerOutline,
//         showParent: true,
//         // 是否显示该菜单
//         showLink: true,
//         roles: ["admin"]
//       }
//     },
//     {
//       path: "/kubernetes/clusters/:id/nodes/:name/detail",
//       name: "NodeDetail", // 必须与跳转时使用的 name 一致
//       component: () => import("@/views/kubernetes/node/components/detail.vue"),
//       meta: {
//         title: "节点详情",
//         showLink: false, // 不在菜单显示
//         showParent: true,
//       }
//     },
//     {
//       path: "/kubernetes/namespaces",
//       name: "Namespaces",
//       component: () => import("@/views/kubernetes/namespace/index.vue"),
//       meta: {
//         title: "命名空间",
//         icon: IconLayersOutline,
//         showParent: true,
//       }
//     },
//     {
//       path: "/kubernetes/workloads",
//       name: "Workloads",
//       meta: {
//         title: "工作负载",
//         icon: "mdi:layers",
//         showParent: true,
//       },
//       children: [
//         {
//           path: "/kubernetes/workload/deployments",
//           name: "Deployments",
//           component: () => import("@/views/kubernetes/workload/deployment/index.vue"),
//           meta: {
//             title: "Deployments",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/workload/statefulsets",
//           name: "StatefulSets",
//           component: () => import("@/views/kubernetes/workload/statefulset/index.vue"),
//           meta: {
//             title: "StatefulSets",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/workload/daemonsets",
//           name: "DaemonSets",
//           component: () => import("@/views/kubernetes/workload/daemonset/index.vue"),
//           meta: {
//             title: "DaemonSets",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/workload/pods",
//           name: "Pod",
//           component: () => import("@/views/kubernetes/workload/pod/index.vue"),
//           meta: {
//             title: "Pods",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/clusters/:id/namespaces/:namespace/daemonsets/:name/detail",
//           name: "DaemonSetDetail",
//           component: () => import("@/views/kubernetes/workload/daemonset/components/detail.vue"),
//           meta: {
//             showLink: false, // 不在菜单显示
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/clusters/:id/namespaces/:namespace/deployments/:name/detail",
//           name: "DeploymentDetail",
//           component: () => import("@/views/kubernetes/workload/deployment/components/detail.vue"),
//           meta: {
//             showLink: false, // 不在菜单显示
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/clusters/:id/namespaces/:namespace/statefulsets/:name/detail",
//           name: "StatefulSetDetail",
//           component: () => import("@/views/kubernetes/workload/statefulset/components/detail.vue"),
//           meta: {
//             showParent: true,
//             showLink: false // 不在菜单显示
//           }
//         },
//         {
//           path: "/kubernetes/clusters/:id/namespaces/:namespace/pods/:name/detail",
//           name: "PodDetail", // 必须与跳转时使用的 name 一致
//           component: () => import("@/views/kubernetes/workload/pod/components/detail.vue"),
//           meta: {
//             showParent: true,
//             showLink: false // 不在菜单显示
//           }
//         },
//       ]
//     },
//     {
//       path: "/kubernetes/network",
//       name: "Network",
//       meta: {
//         title: "服务发现",
//         icon: IconLoadBalancerPool,
//         showParent: true,
//       },
//       children: [
//         {
//           path: "/kubernetes/network/services",
//           name: "Services",
//           component: () => import("@/views/kubernetes/network/service/index.vue"),
//           meta: {
//             title: "Services",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/network/ingress",
//           name: "Ingresses",
//           component: () => import("@/views/kubernetes/workload/deployment/index.vue"),
//           meta: {
//             title: "Ingresses",
//             showParent: true,
//           }
//         }]
//     },
//     {
//       path: "/kubernetes/configuration",
//       name: "configuration",
//       meta: {
//         title: "配置管理",
//         icon: IconConfigSolid,
//         showParent: true,
//       },
//       children: [
//         {
//           path: "/kubernetes/configuration/configmaps",
//           name: "ConfigMaps",
//           component: () => import("@/views/kubernetes/configuration/configmap/index.vue"),
//           meta: {
//             title: "ConfigMaps",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/configuration/secrets",
//           name: "Secrets",
//           component: () => import("@/views/kubernetes/configuration/secret/index.vue"),
//           meta: {
//             title: "Secrets",
//             showParent: true,
//           }
//         }]
//     },
//     {
//       path: "/kubernetes/storage",
//       name: "Storage",
//       meta: {
//         title: "存储管理",
//         icon: IconStorage,
//         showParent: true,
//       },
//       children: [
//         {
//           path: "/kubernetes/storage/persistentvolumes",
//           name: "PersistentVolume",
//           component: () => import("@/views/kubernetes/storage/persistentvolume/index.vue"),
//           meta: {
//             title: "Persistent Volumes",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/storage/persistentvolumeclaims",
//           name: "PersistentVolumeClaim",
//           component: () => import("@/views/kubernetes/storage/persistentvolumeclaim/index.vue"),
//           meta: {
//             title: "Persistent Volume Claims",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/storage/storageclass",
//           name: "StorageClass",
//           component: () => import("@/views/kubernetes/storage/storageclass/index.vue"),
//           meta: {
//             title: "Storage Class",
//             showParent: true,
//           }
//         }
//       ]
//     },
//     {
//       path: "/kubernetes/rbac",
//       meta: {
//         title: "权限管理",
//         icon: IconLockCheckOutline,
//         showParent: true,
//       },
//       children: [
//         {
//           path: "/kubernetes/rbac/permissions",
//           name: "Permission",
//           component: () => import("@/views/kubernetes/rbac/permission/index.vue"),
//           meta: {
//             title: "权限定义",
//             // 是否显示父级菜单
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/rbac/scopes",
//           name: "Scope",
//           component: () => import("@/views/kubernetes/rbac/scope/index.vue"),
//           meta: {
//             title: "资源范围",
//             // 是否显示父级菜单
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/rbac/scope-bindings",
//           name: "ScopeBinding",
//           component: () => import("@/views/kubernetes/rbac/scopebinding/index.vue"),
//           meta: {
//             title: "主体绑定",
//             // 是否显示父级菜单
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/rbac/scope-binding-permissions",
//           name: "ScopeBindingPermission",
//           component: () => import("@/views/kubernetes/rbac/scopebindingpermission/index.vue"),
//           meta: {
//             title: "主体绑定权限",
//             // 是否显示父级菜单
//             showParent: true,
//           }
//         }
//       ]
//     },
//     {
//       path: "/kubernetes/iam",
//       meta: {
//         title: "IAM",
//         showParent: true,
//       },
//       children: [
//         {
//           path: "/kubernetes/iam/roles",
//           name: "IamRole",
//           component: () => import("@/views/kubernetes/iam/role/index.vue"),
//           meta: {
//             title: "Role",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/iam/cluster-roles",
//           name: "IamClusterRole",
//           component: () => import("@/views/kubernetes/iam/cluster-role/index.vue"),
//           meta: {
//             title: "ClusterRole",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/iam/role-bindings",
//           name: "IamRoleBinding",
//           component: () => import("@/views/kubernetes/iam/role-binding/index.vue"),
//           meta: {
//             title: "RoleBinding",
//             showParent: true,
//           }
//         },
//         {
//           path: "/kubernetes/iam/cluster-role-bindings",
//           name: "IamClusterRoleBinding",
//           component: () => import("@/views/kubernetes/iam/cluster-role-binding/index.vue"),
//           meta: {
//             title: "ClusterRoleBinding",
//             showParent: true,
//           }
//         }
//       ]
//     }
//   ]
// };
