#!/usr/bin/env bash
# 部署 prom-lens-frontend 到 Kubernetes
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

KUSTOMIZE_DIR="${KUSTOMIZE_DIR:-deployments/kubernetes}"
NAMESPACE="${NAMESPACE:-prom-lens}"
IMAGE_NAME="${IMAGE_NAME:-prom-lens-frontend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"

if [[ -n "$IMAGE_REGISTRY" ]]; then
  FULL_IMAGE="${IMAGE_REGISTRY%/}/${IMAGE_NAME}:${IMAGE_TAG}"
else
  FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
fi

echo "==> 命名空间: ${NAMESPACE}"
kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}"

echo "==> 部署镜像: ${FULL_IMAGE}"
kubectl apply -k "${KUSTOMIZE_DIR}"

kubectl set image \
  deployment/prom-lens-frontend \
  prom-lens-frontend="${FULL_IMAGE}" \
  -n "${NAMESPACE}" \
  --record

kubectl rollout status deployment/prom-lens-frontend -n "${NAMESPACE}"

echo "==> 部署完成"
kubectl get pods,svc -n "${NAMESPACE}" -l app.kubernetes.io/name=prom-lens-frontend
