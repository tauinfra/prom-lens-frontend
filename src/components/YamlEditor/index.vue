<template>
  <div ref="editorContainer" class="yaml-editor"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch} from 'vue'
import {EditorView, keymap, lineNumbers} from '@codemirror/view'
import {EditorState} from '@codemirror/state'
import { yaml } from '@codemirror/lang-yaml'
import { lintGutter, linter} from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'

// 折叠功能
import { foldGutter, foldKeymap } from "@codemirror/language";

const props = defineProps({
  modelValue: {
    type: [String, Object],
    default: ''
  },
  height: {
    type: String,
    default: '300px'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const editorContainer = ref(null)
editorContainer.value = undefined;
let editorView = null

// 创建编辑器状态
const createEditorState = (content) => {
  let initialContent = typeof content === 'string' ? content : ''

  return EditorState.create({
    doc: initialContent,
    extensions: [
      yaml(),
      foldGutter(),                      // 显示折叠箭头
      keymap.of(foldKeymap),             // 快捷键支持（例如 Ctrl+Shift+[ ])
      oneDark,
      lineNumbers(),
      lintGutter(),     // 在左侧显示红色错误提示
      EditorView.lineWrapping,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const value = update.state.doc.toString()
          emit('update:modelValue', value)
          emit('change', value)
        }
      }),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            const raw = editorView.state.doc.toString()
            emit('update:modelValue', raw)
            return true
          }
        }
      ])
    ]
  })
}

// 初始化编辑器
const initEditor = () => {
  if (editorContainer.value) {
    editorView = new EditorView({
      state: createEditorState(props.modelValue),
      parent: editorContainer.value
    })
  }
}

// 销毁编辑器
const destroyEditor = () => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
}

// 监听 modelValue 变化
watch(() => props.modelValue, (newValue) => {
  if (editorView) {
    const currentValue = editorView.state.doc.toString()
    let newContent = newValue
    if (typeof newValue === 'object') {
      newContent = JSON.stringify(newValue, null, 2)
    }

    if (newContent !== currentValue) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: newContent
        }
      })
    }
  }
})

onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  destroyEditor()
})

// 暴露方法
defineExpose({
  getValue: () => {
    if (!editorView) return ''
    try {
      return JSON.parse(editorView.state.doc.toString())
    } catch {
      return editorView.state.doc.toString()
    }
  }
})
</script>

<style scoped>
.yaml-editor {
  height: v-bind(height);
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.yaml-editor :deep(.cm-editor) {
  height: 100%;
}

.yaml-editor :deep(.cm-scroller) {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.yaml-editor :deep(.cm-content) {
  padding: 8px;
}

.yaml-editor :deep(.cm-gutters) {
  background-color: #282c34;
  border-right: 1px solid #3b4048;
}
</style>
