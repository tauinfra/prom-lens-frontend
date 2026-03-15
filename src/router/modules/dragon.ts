// import IconFactory from '~icons/mdi/factory'
// import IconFolderOutline from '~icons/mdi/folder-outline'
// import IconCubeOutline from '~icons/mdi/cube-outline'
// import IconSourceBranch from '~icons/mdi/source-branch'
// import IconRocket from '~icons/mdi/rocket'
// import IconLockCheckOutline from '~icons/mdi/lock-check-outline'
// import IconTekton from '~icons/simple-icons/tekton'
//
// export default {
//   path: "/dragon",
//   meta: {
//     title: "发布系统",
//     icon: IconFactory,
//   },
//   children: [
//     {
//       path: "/dragon/projects",
//       name: "DRGProject",
//       component: () => import("@/views/dragon/project/index.vue"),
//       meta: {
//         title: "项目管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconFolderOutline,
//       }
//     },
//     {
//       path: "/dragon/pipelines",
//       name: "DRGPipeline",
//       component: () => import("@/views/dragon/pipeline/index.vue"),
//       meta: {
//         title: "发布管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconSourceBranch,
//       },
//     },
//     {
//       path: "/dragon/tekton",
//       meta: {
//         title: "持续交付",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconTekton,
//       },
//       children: [
//         {
//           path: "/dragon/tekton/pipelines",
//           name: "DRGTektonPipeline",
//           component: () => import("@/views/dragon/tekton/pipeline/index.vue"),
//           meta: {
//             title: "Pipeline",
//             // 是否显示父级菜单
//             showParent: true,
//           },
//         },
//         {
//           path: "/dragon/tekton/tasks",
//           name: "DRGTektonTask",
//           component: () => import("@/views/dragon/tekton/task/index.vue"),
//           meta: {
//             title: "Task",
//             // 是否显示父级菜单
//             showParent: true,
//           },
//         },
//         {
//           path: "/dragon/tekton/taskruns",
//           name: "DRGTektonTaskRun",
//           component: () => import("@/views/dragon/tekton/taskrun/index.vue"),
//           meta: {
//             title: "TaskRun",
//             // 是否显示父级菜单
//             showParent: true,
//           },
//         },
//         {
//           path: "/dragon/tekton/pipelineruns",
//           name: "DRGTektonPipelineRun",
//           component: () => import("@/views/dragon/tekton/pipelinerun/index.vue"),
//           meta: {
//             title: "PipelineRun",
//             // 是否显示父级菜单
//             showParent: true,
//           },
//         },
//       ]
//     },
//     {
//       path: "/dragon/credentials",
//       name: "DRGCredential",
//       component: () => import("@/views/dragon/credential/index.vue"),
//       meta: {
//         title: "凭证管理",
//         // 是否显示父级菜单
//         showParent: true,
//         icon: IconLockCheckOutline,
//       }
//     },
//     {
//       path: "/dragon/projects/:projectId/environments/:environmentId/pipelines/:pipelineId/releases",
//       name: "DRGRelease",
//       component: () => import("@/views/dragon/release/index.vue"),
//       meta: {
//         title: "构建任务",
//         // 是否在菜单中显示
//         showLink: false,
//         icon: IconRocket,
//       },
//     },
//   ]
// }
