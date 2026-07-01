FROM node:22-alpine AS build-stage

WORKDIR /app

# 固定 pnpm 版本，避免 @latest（pnpm 11+）要求 Node 22.13+ 导致 Node 20 镜像构建失败
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

ENV HUSKY=0 \
    CI=true

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.27-alpine AS production-stage

ARG VERSION=dev
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.title="prom-lens-frontend" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_TIME}"

COPY deployments/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
