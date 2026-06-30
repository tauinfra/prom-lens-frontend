import { computed, onMounted } from "vue";
import { isString, isEmpty } from "@pureadmin/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  useRouter,
  useRoute,
  type LocationQueryRaw,
  type RouteParamsRaw
} from "vue-router";
import { PROM_GROUP_TYPES, type PromGroupType } from "../constants";

export function usePromGroupContext(options?: { restoreTag?: boolean }) {
  const route = useRoute();
  const router = useRouter();
  const getParameter = isEmpty(route.params) ? route.query : route.params;

  const groupType = computed<PromGroupType>(() => {
    const metaType = route.meta.groupType as PromGroupType | undefined;
    if (metaType) return metaType;
    return route.path.includes("recording-groups")
      ? PROM_GROUP_TYPES.RECORDING
      : PROM_GROUP_TYPES.ALERTING;
  });

  const isRecording = computed(
    () => groupType.value === PROM_GROUP_TYPES.RECORDING
  );

  const listRouteName = computed(() =>
    isRecording.value ? "PromRecordingGroup" : "PromAlertingGroup"
  );

  const detailRouteName = computed(() =>
    isRecording.value ? "PromRecord" : "PromAlertRule"
  );

  const detailTagTitle = computed(() =>
    isRecording.value ? "聚合规则" : "告警规则"
  );

  const detailPathTemplate = computed(() =>
    isRecording.value
      ? "/prometheus/recording-groups/:id/records"
      : "/prometheus/alerting-groups/:id/rules"
  );

  const listPath = computed(() =>
    isRecording.value
      ? "/prometheus/recording-groups"
      : "/prometheus/alerting-groups"
  );

  function goToDetail(
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
        name: detailRouteName.value,
        params: parameter,
        path: detailPathTemplate.value,
        meta: {
          title: detailTagTitle.value
        }
      });
      router.push({ name: detailRouteName.value, params: parameter });
    }
  }

  if (options?.restoreTag) {
    onMounted(() => {
      if (
        (route.name === "PromAlertRule" || route.name === "PromRecord") &&
        !isEmpty(getParameter)
      ) {
        goToDetail(getParameter as RouteParamsRaw, "params");
      }
    });
  }

  return {
    route,
    router,
    getParameter,
    groupType,
    isRecording,
    listRouteName,
    detailRouteName,
    detailTagTitle,
    listPath,
    goToDetail
  };
}
