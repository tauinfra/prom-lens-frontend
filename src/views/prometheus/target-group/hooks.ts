import { isString, isEmpty } from "@pureadmin/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  useRouter,
  useRoute,
  type LocationQueryRaw,
  type RouteParamsRaw
} from "vue-router";
import { onMounted } from "vue";

export function useTargets() {
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

    onMounted(() => {
      if (route.name === "PromTarget" && !isEmpty(getParameter)) {
        initToTargets("params");
      }
    });

    if (model === "params") {
      useMultiTagsStoreHook().handleTags("push", {
        name: "PromTarget",
        params: parameter,
        path: `/prometheus/target-groups/:id/targets`,
        meta: {
          title: "Target 实例",
        }
      });
      router.push({ name: "PromTarget", params: parameter });
    }
  }

  const initToTargets = (model: "params") => {
    goToTargets(getParameter, model);
  };

  return { goToTargets, initToTargets, getParameter, router };
}
