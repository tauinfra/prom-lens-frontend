import { onMounted } from "vue";
import { isString, isEmpty } from "@pureadmin/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  useRouter,
  useRoute,
  type LocationQueryRaw,
  type RouteParamsRaw
} from "vue-router";

export function usePromTargetGroupContext(options?: { restoreTag?: boolean }) {
  const route = useRoute();
  const router = useRouter();
  const getParameter = isEmpty(route.params) ? route.query : route.params;

  function goToTargets(
    parameter: LocationQueryRaw | RouteParamsRaw,
    model: "query" | "params"
  ) {
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    if (model === "params") {
      useMultiTagsStoreHook().handleTags("push", {
        name: "PromTarget",
        params: parameter,
        path: "/prometheus/target-groups/:id/targets",
        meta: {
          title: "采集目标"
        }
      });
      router.push({ name: "PromTarget", params: parameter });
    }
  }

  if (options?.restoreTag) {
    onMounted(() => {
      if (route.name === "PromTarget" && !isEmpty(getParameter)) {
        goToTargets(getParameter as RouteParamsRaw, "params");
      }
    });
  }

  return {
    route,
    router,
    getParameter,
    goToTargets
  };
}
