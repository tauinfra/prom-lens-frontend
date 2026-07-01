# Prom Lens Frontend

Prom Lens 平台前端，提供 Prometheus 规则管理、告警通知、审计日志与用户管理等功能。需配合 [prom-lens-backend](https://github.com/tauinfra/prom-lens-backend) 使用。

## 前端框架

本项目基于 **[vue-pure-admin 精简版（pure-admin-thin）](https://github.com/pure-admin/pure-admin-thin)** 二次开发，底层框架为 **[vue-pure-admin](https://github.com/pure-admin/vue-pure-admin)**。

| 类别   | 技术                    |
| ------ | ----------------------- |
| 框架   | Vue 3 + TypeScript      |
| 构建   | Vite 6                  |
| UI     | Element Plus            |
| 状态   | Pinia                   |
| 路由   | Vue Router（Hash 模式） |
| 样式   | Tailwind CSS + SCSS     |
| HTTP   | Axios                   |
| 包管理 | pnpm 10                 |

更多布局、权限、主题等能力来自 vue-pure-admin 生态，可参考官方文档：[pure-admin.cn](https://pure-admin.cn/)

## 功能模块

| 模块       | 说明                                             |
| ---------- | ------------------------------------------------ |
| Prometheus | 告警规则组、聚合规则组及规则编辑（YAML）         |
| 告警通知   | Webhook 通道列表、测试、详情与 Alertmanager 配置 |
| 审计管理   | 登录日志、操作日志                               |
| 用户管理   | 用户 CRUD、重置密码（仅超级管理员可见）          |

## 环境要求

- Node.js `^18.18.0` / `^20.9.0` / `>=22.0.0`
- pnpm `>=9`（推荐 `10.33.0`，见 `packageManager` 字段）
- 本地开发需启动 prom-lens-backend（默认 `http://127.0.0.1:8080`）

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务（默认 http://localhost:8848）
pnpm dev
```

开发环境下，`/api` 请求由 Vite 代理至后端，可在 `vite.config.ts` 中修改 `server.proxy` 目标地址。

默认访问：`http://localhost:8848/#/login`

## 构建

```bash
# 类型检查
pnpm typecheck

# 生产构建（产物输出至 dist/）
pnpm build

# 预发布构建
pnpm build:staging
```

## 部署

### 构建镜像

```bash
# 构建并打标签
./scripts/build.sh

# 构建并推送
PUSH=1 ./scripts/build.sh

# 仅本地标签（不拼接 registry）
LOCAL=1 IMAGE_TAG=latest ./scripts/build.sh
```

镜像定义见 `deployments/docker/Dockerfile`：Node 多阶段构建静态资源，运行时为 Nginx。

### 部署到 Kubernetes

```bash
# 需已配置 kubectl，且集群内存在 prom-lens-backend
kubectl apply -k deployments/kubernetes
```

清单位于 `deployments/kubernetes/`：

- **Deployment**：Nginx 托管前端静态文件
- **ConfigMap**：Nginx 配置，`/api/` 反向代理至 `prom-lens-backend.prom-lens.svc.cluster.local:8080`
- **Service**：ClusterIP `:80`

默认命名空间：`prom-lens`

## 目录结构

```
├── src/
│   ├── api/              # 后端 API 封装
│   ├── router/modules/   # 路由与菜单
│   ├── views/            # 页面
│   │   ├── prometheus/   # Prometheus 规则
│   │   ├── alerting/     # 告警通知
│   │   ├── audit/        # 审计日志
│   │   └── authn/        # 用户管理
│   └── layout/           # 布局（来自 vue-pure-admin）
├── deployments/
│   ├── docker/           # Dockerfile、Nginx 配置
│   └── kubernetes/       # K8s 清单
└── scripts/
    ├── build.sh          # 构建镜像
    └── deploy-k8s.sh     # 部署到 K8s
```

## 配置说明

| 文件                          | 说明                             |
| ----------------------------- | -------------------------------- |
| `.env.development`            | 开发端口、路由模式等             |
| `.env.production`             | 生产构建配置                     |
| `public/platform-config.json` | 平台标题、布局、主题等运行时配置 |
| `vite.config.ts`              | 构建与开发代理                   |

路由模式当前为 **Hash**（`/#/path`），生产环境由 Nginx 提供静态资源，API 通过同源 `/api/` 访问后端。

## 许可证

[MIT](./LICENSE)

基于 vue-pure-admin 精简版，遵循原项目 MIT 许可证。
