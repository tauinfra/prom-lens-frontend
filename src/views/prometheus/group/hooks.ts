import { isString, isEmpty } from "@pureadmin/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  useRouter,
  useRoute,
  type LocationQueryRaw,
  type RouteParamsRaw
} from "vue-router";
import { onMounted } from "vue";

export function useRules() {
  const route = useRoute();
  const router = useRouter();
  const getParameter = isEmpty(route.params) ? route.query : route.params;

  function goToRules(
    parameter: LocationQueryRaw | RouteParamsRaw,
    model: "query" | "params"
  ) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });

    // 初始化时恢复标签页
    onMounted(() => {
      if (route.name === "PromRule" && !isEmpty(getParameter)) {
        initToRules("params");
      }
    });


    if (model === "params") {
      useMultiTagsStoreHook().handleTags("push", {
        name: "PromRule",
        params: parameter,
        path: `/prometheus/groups/:id/rules`,
        meta: {
          title: "Alerting Rules",
        }
      });
      router.push({ name: "PromRule", params: parameter });
    }
  }

  // 用于页面刷新，重新获取浏览器地址栏参数并保存到标签页
  const initToRules = (model: "params") => {
    goToRules(getParameter, model);
  };

  return { goToRules, initToRules, getParameter, router };
}
