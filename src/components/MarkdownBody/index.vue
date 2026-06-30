<script setup lang="ts">
import { computed } from "vue";
import { renderMarkdownToHtml } from "@/utils/markdown";

defineOptions({
  name: "MarkdownBody"
});

const props = defineProps<{
  content: string;
}>();

const html = computed(() => renderMarkdownToHtml(props.content || ""));
</script>

<template>
  <div v-if="html" class="markdown-body" v-html="html" />
</template>

<style scoped lang="scss">
.markdown-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  word-break: break-word;

  :deep(p) {
    margin: 0 0 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.25em;
    margin: 0 0 8px;
  }

  :deep(li) {
    margin-bottom: 4px;
  }

  :deep(code) {
    padding: 1px 5px;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    background: var(--el-fill-color);
    border-radius: 3px;
  }

  :deep(.md-pre) {
    padding: 8px 10px;
    margin: 0 0 8px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;

    code {
      padding: 0;
      word-break: break-word;
      white-space: pre-wrap;
      background: transparent;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
