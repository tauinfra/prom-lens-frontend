<template>
  <Codemirror
    v-model:value="innerCode"
    :options="cmOptions"
    border
    :height="height"
  />
</template>

<script>
import { ref, defineComponent, watch, nextTick } from "vue";
import Codemirror, {
  createLogMark,
  createLinkMark,
  createTitle,
} from "codemirror-editor-vue3";
import "codemirror/theme/dracula.css";

export default defineComponent({
  name: "LogViewer",
  components: { Codemirror },
  props: {
    modelValue: { type: String, default: "" },
    autoScroll: { type: Boolean, default: true },
    height: { type: Number, default: 500 },
  },

  setup(props, { emit }) {
    const innerCode = ref(props.modelValue);
    const cmOptions = {
      mode: "text/x-log",
      theme: "dracula",
    };

    /** 同步外部 v-model */
    watch(
      () => props.modelValue,
      (val) => {
        innerCode.value = val;

        // 自动滚动到底部
        if (props.autoScroll) {
          nextTick(() => {
            const wrap = document.querySelector(".cm-content");
            if (wrap) wrap.scrollTop = wrap.scrollHeight;
          });
        }
      }
    );

    watch(innerCode, (val) => emit("update:modelValue", val));

    return {
      innerCode,
      cmOptions,
      createLogMark,
      createLinkMark,
      createTitle,
    };
  },
});
</script>
