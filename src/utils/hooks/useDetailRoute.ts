import { isString } from "@pureadmin/utils";
import { useRouter, useRoute, type RouteParamsRaw } from "vue-router";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { getPodTerminal } from "@/api/kubernetes";

// 定义 API 返回类型
interface ApiResponse<T = any> {
  data?: T  // 后端返回错误时，无 data 字段，改为可选属性
  code: number
  msg?: string
  success: boolean
}

export function useDetailRoutes() {
  const route = useRoute();
  const router = useRouter();

  // DaemonSet Detail
  function goToDaemonSetDetail(parameter: RouteParamsRaw) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    useMultiTagsStoreHook().handleTags("push", {
      name: "DaemonSetDetail",
      params: parameter,
      path: `/kubernetes/clusters/:id/namespaces/:namespace/DaemonSets/:name/detail`,
      meta: {
        title: `DaemonSet - ${parameter.name || parameter.id}`,
      }
    });
    router.push({ name: "DaemonSetDetail", params: parameter });
  }
  // Deployment Detail
  function goToDeploymentDetail(parameter: RouteParamsRaw) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    useMultiTagsStoreHook().handleTags("push", {
      name: "DeploymentDetail",
      params: parameter,
      path: `/kubernetes/clusters/:id/namespaces/:namespace/deployments/:name/detail`,
      meta: {
        title: `Deployment - ${parameter.name || parameter.id}`,
      }
    });
    router.push({ name: "DeploymentDetail", params: parameter });
  }

  // StatefulSet Detail
  function goToStatefulSetDetail(parameter: RouteParamsRaw) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    useMultiTagsStoreHook().handleTags("push", {
      name: "StatefulSetDetail",
      params: parameter,
      path: `/kubernetes/clusters/:id/namespaces/:namespace/statefulsets/:name/detail`,
      meta: {
        title: `StatefulSet - ${parameter.name || parameter.id}`,
      }
    });
    router.push({ name: "StatefulSetDetail", params: parameter });
  }

  // Pod Terminal
  function goToPodTerminal(parameter: RouteParamsRaw) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });
    const Url = router.resolve({
      name: "PodTerminal",
      params: parameter
    })
    window.open(Url.href, '_blank');
  }

  // Pod Detail
  function goToPodDetail(parameter: RouteParamsRaw) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    useMultiTagsStoreHook().handleTags("push", {
      name: "PodDetail",
      params: parameter,
      path: `/kubernetes/clusters/:id/namespaces/:namespace/pods/:name/detail`,
      meta: {
        title: `Pod - ${parameter.name || parameter.id}`,
      }
    });
    router.push({ name: "PodDetail", params: parameter });
  }

  // Ingress Detail
  function goToIngressDetail(parameter: RouteParamsRaw) {
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    useMultiTagsStoreHook().handleTags("push", {
      name: "IngressDetail",
      params: parameter,
      path: `/kubernetes/clusters/:id/namespaces/:namespace/ingresses/:name/detail`,
      meta: {
        title: `Ingress - ${parameter.name || parameter.id}`,
      }
    });
    router.push({ name: "IngressDetail", params: parameter });
  }

  // Pipeline Releases
  function goToReleases(parameter: RouteParamsRaw) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    useMultiTagsStoreHook().handleTags("push", {
      name: "DRGRelease",
      params: parameter,
      path: `/dragon/projects/:projectId/environments/:environmentId/pipelines/:pipelineId/releases`,
      meta: {
        title: `发布任务`,
      }
    });
    router.push({ name: "DRGRelease", params: parameter });
  }


  // 用于页面刷新（如果需要的话）
  const initToRules = () => {
    if (Object.keys(route.params).length > 0) {
      // 如果需要支持页面刷新，可以在这里处理
    }
  };

  return {
    goToDaemonSetDetail,
    goToDeploymentDetail,
    goToStatefulSetDetail,
    goToPodDetail,
    goToPodTerminal,
    goToIngressDetail,
    goToReleases,
    initToRules,
    getParameter: route.params,
    router,
  };
}
