<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'
import { getToken } from '@/utils/auth'
import { useDetailRoutes } from '@/utils/hooks/useDetailRoute'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'

const tokenInfo = getToken()
const token = tokenInfo?.accessToken || ''
const { getParameter } = useDetailRoutes()
const router = useRouter()

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
const status = ref<ConnectionStatus>('connecting')
const statusMessage = ref('')

const statusText = computed(() => {
  const map: Record<ConnectionStatus, string> = {
    connecting: '连接中...',
    connected: '已连接',
    disconnected: '已断开',
    error: '连接失败',
  }
  return map[status.value] || ''
})

const terminalRef = ref<HTMLElement | null>(null)
const terminalWrapRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let resizeHandler: (() => void) | null = null
let fullscreenHandler: (() => void) | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null
const CONNECT_TIMEOUT_MS = 15000

const params = getParameter as { id: string; ns: string; name: string; container: string }

function buildWelcomeMessage(): string {
  const time = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  return `
════════════════════════════════════════════════════════════════
                       POD TERMINAL ACCESS
════════════════════════════════════════════════════════════════
 Cluster:   ${params.id}
 Namespace: ${params.ns}
 Pod Name:  ${params.name}
 Container: ${params.container}
 Connected: ${time}
════════════════════════════════════════════════════════════════
        Welcome to the Kubernetes Container Platform !
════════════════════════════════════════════════════════════════
  Authorized use only. Session may be audited.
  Type 'exit' or press Ctrl+D to end the session.
════════════════════════════════════════════════════════════════

`
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({
      path: '/kubernetes/workload/pods',
      query: router.currentRoute.value.query
    })
  }
}

function toggleFullscreen() {
  const wrap = terminalWrapRef.value
  if (!wrap) return
  if (!document.fullscreenElement) {
    wrap.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

function getWsBaseUrl(): string {
  const base = import.meta.env.VITE_WS_BASE_URL
  if (base && typeof base === 'string') return base.replace(/\/$/, '')
  // 开发环境与 vite 代理一致，直连后端，避免 WebSocket 未代理导致一直连接中
  if (import.meta.env.DEV) {
    return 'ws://127.0.0.1:8080'
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}`
}

onMounted(() => {
  document.title = `终端 - ${params.name} / ${params.container}`

  const el = terminalRef.value
  if (!el) return

  fitAddon = new FitAddon()
  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    convertEol: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f78',
      black: '#1e1e1e',
      red: '#f44747',
      green: '#6a9955',
      yellow: '#dcdcaa',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#d4d4d4',
    },
  })

  term.loadAddon(new WebLinksAddon())
  term.loadAddon(fitAddon)
  term.open(el)
  fitAddon.fit()
  term.focus()

  const { id, ns, name, container } = params
  const wsBase = getWsBaseUrl()
  const url = `${wsBase}/api/v1/kubernetes/clusters/${id}/namespaces/${ns}/pods/${name}/containers/${container}/exec`
  ws = new WebSocket(url, [token])

  connectTimeoutTimer = setTimeout(() => {
    if (status.value === 'connecting' && ws?.readyState !== WebSocket.OPEN) {
      status.value = 'error'
      statusMessage.value = '连接超时，请检查后端服务是否启动或网络是否正常'
      ws?.close()
    }
  }, CONNECT_TIMEOUT_MS)

  const doResize = () => {
    if (fitAddon && ws?.readyState === WebSocket.OPEN) {
      fitAddon.fit()
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
  }

  resizeHandler = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(doResize, 150)
  }

  ws.onopen = () => {
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
    status.value = 'connected'
    statusMessage.value = ''
    term?.write(buildWelcomeMessage())

    // ⭐ 关键：连接成功立即同步终端尺寸
    setTimeout(() => {
      doResize()
    }, 100)

    term?.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdin', stdin: data }))
      }
    })

    window.addEventListener('resize', resizeHandler!)
    fullscreenHandler = () => {
      isFullscreen.value = !!document.fullscreenElement
      setTimeout(doResize, 100)
    }
    document.addEventListener('fullscreenchange', fullscreenHandler)
    // 监听终端尺寸变化
    term?.onResize((size) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }))
      }
    })
  }

  ws.onmessage = (event) => {
    term?.write(event.data.toString())
  }

  ws.onerror = () => {
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
    status.value = 'error'
    statusMessage.value = '连接失败，请检查网络或权限后重试'
  }

  ws.onclose = () => {
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
    if (status.value === 'connecting') {
      status.value = 'error'
      statusMessage.value = '连接已关闭，请检查后端服务或网络'
    } else if (status.value !== 'error') {
      status.value = 'disconnected'
      statusMessage.value = '连接已断开'
    }
  }
})

onUnmounted(() => {
  document.title = ''
  if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer)
  if (fullscreenHandler) {
    document.removeEventListener('fullscreenchange', fullscreenHandler)
  }
  if (resizeTimer) clearTimeout(resizeTimer)
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close()
  }
  term?.dispose()
  term = null
  fitAddon = null
  ws = null
})
</script>

<template>
  <div class="terminal-page">
    <div class="terminal-header">
      <div class="terminal-info">
        <span class="info-item">集群: {{ params.id }}</span>
        <span class="info-item">命名空间: {{ params.ns }}</span>
        <span class="info-item">Pod: {{ params.name }}</span>
        <span class="info-item">容器: {{ params.container }}</span>
      </div>
      <div class="terminal-actions">
        <span
          class="status-badge"
          :class="status"
        >
          {{ statusText }}
        </span>
        <el-button
          v-show="status === 'connected'"
          size="small"
          text
          @click="toggleFullscreen"
        >
          全屏
        </el-button>
      </div>
    </div>

    <div
      v-if="status === 'connecting'"
      class="terminal-loading"
    >
      <el-icon class="loading-icon"><Refresh /></el-icon>
      <span>正在连接容器终端...</span>
    </div>

    <div
      v-else-if="status === 'error' || status === 'disconnected'"
      class="terminal-error"
    >
      <el-result
        :icon="status === 'error' ? 'error' : 'info'"
        :title="status === 'error' ? '连接失败' : '连接已断开'"
      >
        <template #sub-title>
          <span>{{ statusMessage }}</span>
        </template>
        <template #extra>
          <el-button type="primary" @click="goBack">返回 Pod 详情</el-button>
        </template>
      </el-result>
    </div>

    <div
      v-show="status === 'connected'"
      ref="terminalWrapRef"
      class="terminal-wrap"
    >
      <div ref="terminalRef" class="terminal-container" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.terminal-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  background: var(--el-bg-color-page, #f5f7fa);
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 12px 16px;
  background: var(--el-bg-color, #fff);
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.terminal-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);

  .info-item {
    &::before {
      margin-right: 4px;
      color: var(--el-text-color-secondary, #909399);
    }
  }
}

.terminal-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;

  &.connecting {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.connected {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }

  &.disconnected {
    color: var(--el-color-info);
    background: var(--el-color-info-light-9);
  }

  &.error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
}

.terminal-loading {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 320px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 14px;

  .loading-icon {
    font-size: 32px;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.terminal-error {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 24px;
}

.terminal-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 16px;
}

.terminal-container {
  flex: 1;
  min-height: 360px;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
}

:deep(.terminal-container .xterm) {
  height: 100%;
  padding: 8px;
}

:deep(.terminal-container .xterm-viewport) {
  overflow-y: auto !important;
}
</style>
