<template>
  <div ref="editorContainer" class="json-editor"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { lintGutter, linter } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'

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

// JSON 校验器
const jsonLinter = linter(async (view) => {
  try {
    JSON.parse(view.state.doc.toString())
    return []
  } catch (err) {
    return [{
      from: 0,
      to: view.state.doc.length,
      severity: 'error',
      message: err.message
    }]
  }
})

// 创建编辑器状态
const createEditorState = (content) => {
  let initialContent = content
  if (typeof content === 'object') {
    initialContent = JSON.stringify(content, null, 2)
  }

  return EditorState.create({
    doc: initialContent,
    extensions: [
      json(),
      lintGutter(),
      lineNumbers(),
      jsonLinter,
      oneDark,
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
            try {
              const jsonValue = JSON.parse(editorView.state.doc.toString())
              emit('update:modelValue', jsonValue)
              return true
            } catch (err) {
              return false
            }
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
.json-editor {
  height: v-bind(height);
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.json-editor :deep(.cm-editor) {
  height: 100%;
}

.json-editor :deep(.cm-scroller) {
  font-family: 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.json-editor :deep(.cm-content) {
  padding: 8px;
}

.json-editor :deep(.cm-gutters) {
  background-color: #282c34;
  border-right: 1px solid #3b4048;
}
</style>
