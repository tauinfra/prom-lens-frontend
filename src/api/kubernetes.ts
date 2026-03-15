import { http } from "@/utils/http";
import { kubeUrlApi } from "./utils";
import type { PaginationParams } from './types'

/** 查询权限列表 */
export const getPermissions = (params: PaginationParams) => {
  return http.request("get", kubeUrlApi("permissions"), { params });
};

/** K8s 用户权限单条（GET /api/v1/kubernetes/permissions 返回项） */
export interface K8sUserPermissionItem {
  id: number
  userID: number
  username: string
  clusterID: number
  clusterName: string
  namespace: string
  role: string
  creator?: string
  createdAt?: string
  updatedAt?: string
}

/** 查询 K8s 用户权限列表（可按 userID 筛选） */
export const getK8sUserPermissions = (params?: { userID?: number }) => {
  return http.request("get", kubeUrlApi("permissions"), { params });
};

/** 批量添加 K8s 用户权限：{ userID, clusters: [{ clusterID, bindings: [{ namespace, role }] }] } */
export const batchK8sUserPermissions = (data: {
  userID: number
  clusters: Array<{ clusterID: number; bindings: Array<{ namespace: string; role: string }> }>
}) => {
  return http.request("post", kubeUrlApi("permissions/batch"), { data });
};

/** 创建权限 */
export const createPermission = (data: object) => {
  return http.request("post", kubeUrlApi("permissions"), { data });
};

/** 更新权限 */
export const updatePermission = (id: number, data: object) => {
  return http.request("patch", kubeUrlApi(`permissions/${id}`), { data });
};

/** 删除权限 */
export const deletePermission = (id: number) => {
  return http.request("delete", kubeUrlApi(`permissions/${id}`));
};

/** 批量删除权限 */
export const batchDeletePermissions = (data: { ids: number[] }) => {
  return http.request("delete", kubeUrlApi("permissions/batch-delete"), { data });
};

/** 查询域列表 */
export const getScopes = (params: PaginationParams) => {
  return http.request("get", kubeUrlApi("scopes"), { params });
};

/** 创建域 */
export const createScope = (data: object) => {
  return http.request("post", kubeUrlApi("scopes"), { data });
};

/** 更新域 */
export const updateScope = (id: number, data: object) => {
  return http.request("patch", kubeUrlApi(`scopes/${id}`), { data });
};

/** 删除域 */
export const deleteScope = (id: number) => {
  return http.request("delete", kubeUrlApi(`scopes/${id}`));
};

/** 批量删除域 */
export const batchDeleteScopes = (data: { ids: number[] }) => {
  return http.request("delete", kubeUrlApi("scopes/batch-delete"), { data });
};

/** 查询域列表 */
export const getScopeBindingPermissions = (params: PaginationParams) => {
  return http.request("get", kubeUrlApi("scope-binding-permissions"), { params });
};

/** 创建域 */
export const createScopeBindingPermission = (data: object) => {
  return http.request("post", kubeUrlApi("scope-binding-permissions"), { data });
};

/** 更新域 */
export const updateScopeBindingPermission = (id: number, data: object) => {
  return http.request("patch", kubeUrlApi(`scope-binding-permissions/${id}`), { data });
};

/** 删除域 */
export const deleteScopeBindingPermission = (id: number) => {
  return http.request("delete", kubeUrlApi(`scope-binding-permissions/${id}`));
};

/** 批量删除域绑定权限 */
export const batchDeleteScopeBindingPermissions = (data: { ids: number[] }) => {
  return http.request("delete", kubeUrlApi("scope-binding-permissions/batch-delete"), { data });
};

/** 查询绑定域列表 */
export const getScopeBindings = (params: PaginationParams) => {
  return http.request("get", kubeUrlApi("scope-bindings"), { params });
};

/** 创建绑定域 */
export const createScopeBinding = (data: object) => {
  return http.request("post", kubeUrlApi("scope-bindings"), { data });
};

/** 更新绑定域 */
export const updateScopeBinding = (id: number, data: object) => {
  return http.request("patch", kubeUrlApi(`scope-bindings/${id}`), { data });
};

/** 删除绑定域 */
export const deleteScopeBinding = (id: number) => {
  return http.request("delete", kubeUrlApi(`scope-bindings/${id}`));
};

/** 批量删除绑定域 */
export const batchDeleteScopeBindings = (data: { ids: number[] }) => {
  return http.request("delete", kubeUrlApi("scope-bindings/batch-delete"), { data });
};

/** 查询集群列表 */
export const getClusters = async (params: PaginationParams) => {
  const response = await http.request<{ success?: boolean; msg?: string } & Record<string, any>>(
    "get",
    kubeUrlApi("clusters"),
    { params }
  );
  if (response?.success !== true) {
    return Promise.reject({ msg: response?.msg || "获取集群列表失败" });
  }
  return response;
};

/** 查询集群 */
export const getCluster = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}`));
};

/** 创建集群 */
export const createCluster = (data: object) => {
  return http.request("post", kubeUrlApi("clusters"), { data });
};

/** 更新集群 */
export const updateCluster = (id: number, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}`), { data });
};

/** 更新集群凭证 */
export const updateClusterToken = (id: number, data: { token: string }) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/token`), { data });
};

/** 删除集群 */
export const deleteCluster = (id: number) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}`));
};

/** 查询节点列表 */
export const getNodes = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/nodes`));
};

/** 查询节点详情 */
export const getNode = (id: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/nodes/${name}/detail`));
};

/** 更新节点标签 */
export const updateNodeLabels = (id: number, name: any, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/nodes/${name}/labels`), { data });
};

/** 更新节点污点*/
export const updateNodeTaints = (id: number, name: any, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/nodes/${name}/taints`), { data });
};

/** 更新节点调度状态*/
export const updateNodeCordon = (id: number, name: string) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/nodes/${name}/cordon`));
};

/** 查询命名空间列表 */
export const getNamespaces = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces`));
};

/** 创建命名空间 */
export const createNamespace = (id: number, data: object) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces`), { data });
};

/** 更新命名空间标签 */
export const updateNamespace = (id: number, name: string, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${name}/labels`), { data });
};

/** 更新命名空间标签 */
export const deleteNamespace = (id: number, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${name}`));
};

/** 批量删除命名空间 */
export const batchDeleteNamespaces = (id: number, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/batch-delete`), { data });
};

/** 查询 Deployment 列表 */
export const getDeployments = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments`));
};

/** 查询 Deployment 详情 */
export const getDeploymentDetail = (id: string, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}/detail`));
};

/** 查询 Deployment YAMl  */
export const getDeployment = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}`));
};

/** 创建 Deployment  */
export const createDeployment = (id: number, ns: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments`), {data});
};

/** 更新 Deployment  */
export const updateDeployment = (id: number, ns, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}`), {data});
};

/** 删除 Deployment */
export const deleteDeployment = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}`));
};

/** 批量删除 Deployment */
export const batchDeleteDeployments = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/batch-delete`), { data });
};

/** 重启 Deployment  */
export const restartDeployment = (id: number, ns, name: string) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}/restart`));
};

/** 伸缩 Deployment  */
export const scaleDeployment = (id: number, ns, name: string, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}/scale`), {data});
};

/** 回滚 Deployment  */
export const rolloutDeployment = (id, ns, name: string, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/deployments/${name}/rollout`), {data});
};

/** 查询 StatefulSet 列表 */
export const getStatefulSets = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets`));
};

/** 查询 StatefulSet 详情 */
export const getStatefulSetDetail = (id: string, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/${name}/detail`));
};

/** 查询 StatefulSet YAMl  */
export const getStatefulSet = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/${name}`));
};

/** 创建 StatefulSet */
export const createStatefulSet = (id: number, ns, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets`), {data});
};

/** 更新 StatefulSet */
export const updateStatefulSet = (id: number, ns, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/${name}`), {data});
};

/** 删除 StatefulSet */
export const deleteStatefulSet = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/${name}`));
};

/** 批量删除 StatefulSet */
export const batchDeleteStatefulSets = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/batch-delete`), { data });
};

/** 重启 StatefulSet  */
export const restartStatefulSet = (id: number, ns, name: string) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/${name}/restart`));
};

/** 伸缩 StatefulSet  */
export const scaleStatefulSet = (id: number, ns, name: string, data: object) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/statefulsets/${name}/scale`), {data});
};

/** 查询 DaemonSet 列表 */
export const getDaemonSets = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets`));
};

/** 查询 DaemonSet 详情  */
export const getDaemonSetDetail = (id, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets/${name}/detail`));
};

/** 查询 DaemonSet YAMl  */
export const getDaemonSet = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets/${name}`));
};

/** 创建 DaemonSet */
export const createDaemonSet = (id: number, ns, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets`), {data});
};

/** 更新 DaemonSet */
export const updateDaemonSet = (id: number, ns, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets/${name}`), {data});
};

/** 删除 DaemonSet */
export const deleteDaemonSet = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets/${name}`));
};

/** 批量删除 DaemonSet */
export const batchDeleteDaemonSets = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets/batch-delete`), { data });
};

/** 重启 DaemonSet  */
export const restartDaemonSet = (id: number, ns, name: string) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/daemonsets/${name}/restart`));
};

/** 查询 Job 列表 */
export const getJobs = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/jobs`));
};

/** 查询 Job YAML */
export const getJob = (id: number, ns: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/jobs/${name}`));
};

/** 创建 Job */
export const createJob = (id: number, ns: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/jobs`), { data });
};

/** 更新 Job */
export const updateJob = (id: number, ns: string, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/jobs/${name}`), { data });
};

/** 删除 Job */
export const deleteJob = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/jobs/${name}`));
};

/** 查询 CronJob 列表 */
export const getCronJobs = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/cronjobs`));
};

/** 查询 CronJob YAML */
export const getCronJob = (id: number, ns: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/cronjobs/${name}`));
};

/** 创建 CronJob */
export const createCronJob = (id: number, ns: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/cronjobs`), { data });
};

/** 更新 CronJob */
export const updateCronJob = (id: number, ns: string, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/cronjobs/${name}`), { data });
};

/** 删除 CronJob */
export const deleteCronJob = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/cronjobs/${name}`));
};

/** 查询 Service 列表 */
export const getServices = (id: string, ns: string, params?: any) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/services`), {params});
};

/** 查询 Service YAMl  */
export const getService = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/services/${name}`));
};

/** 创建 Service  */
export const createService = (id: number, ns, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/services`), {data});
};

/** 更新 Service  */
export const updateService = (id: number, ns, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/services/${name}`), {data});
};

/** 删除 Service  */
export const deleteService = (id: number, ns, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/services/${name}`));
};

/** 批量删除 Service */
export const batchDeleteServices = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/services/batch-delete`), { data });
};

/** 查询 Ingress 列表 */
export const getIngresses = (id: number | string, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses`));
};

/** 查询 Ingress YAML */
export const getIngress = (id: number, ns: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses/${name}`));
};

/** 查询 Ingress 详情 */
export const getIngressDetail = (id: string, ns: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses/${name}/detail`));
};

/** 创建 Ingress */
export const createIngress = (id: number, ns: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses`), { data });
};

/** 更新 Ingress */
export const updateIngress = (id: number, ns: string, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses/${name}`), { data });
};

/** 删除 Ingress */
export const deleteIngress = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses/${name}`));
};

/** 批量删除 Ingress */
export const batchDeleteIngresses = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/ingresses/batch-delete`), { data });
};

/** 查询 ConfigMap 列表 */
export const getConfigMaps = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/configmaps`));
};

/** 查询 ConfigMap YAMl */
export const getConfigMap = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/configmaps/${name}`));
};

/** 创建 ConfigMap */
export const createConfigMap = (id: number, ns, name: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/configmaps`), {data});
};

/** 更新 ConfigMap  */
export const updateConfigMap = (id: number, ns, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/configmaps/${name}`), {data});
};

/** 删除 ConfigMap */
export const deleteConfigMap = (id: number, ns, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/configmaps/${name}`));
};

/** 批量删除 ConfigMap */
export const batchDeleteConfigMaps = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/configmaps/batch-delete`), { data });
};

/** ---------- IAM Role（命名空间级，K8s 资源） ---------- */
/** 查询 Role 列表 */
export const getKubeRoles = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/roles`));
};

/** 查询 Role YAML */
export const getKubeRole = (id: number, ns: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/roles/${name}`));
};

/** 创建 Role */
export const createKubeRole = (id: number, ns: string, name: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/roles`), { data });
};

/** 更新 Role */
export const updateKubeRole = (id: number, ns: string, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/roles/${name}`), { data });
};

/** 删除 Role */
export const deleteKubeRole = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/roles/${name}`));
};

/** 批量删除 Role */
export const batchDeleteKubeRoles = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/roles/batch-delete`), { data });
};

/** ---------- IAM ClusterRole（集群级） ---------- */
/** 查询 ClusterRole 列表 */
export const getClusterRoles = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/clusterroles`));
};

/** 查询 ClusterRole YAML */
export const getClusterRole = (id: number, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/clusterroles/${name}`));
};

/** 创建 ClusterRole */
export const createClusterRole = (id: number, name: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/clusterroles`), { data });
};

/** 更新 ClusterRole */
export const updateClusterRole = (id: number, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/clusterroles/${name}`), { data });
};

/** 删除 ClusterRole */
export const deleteClusterRole = (id: number, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/clusterroles/${name}`));
};

/** 批量删除 ClusterRole */
export const batchDeleteClusterRoles = (id: number, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/clusterroles/batch-delete`), { data });
};

/** ---------- IAM RoleBinding（命名空间级） ---------- */
/** 查询 RoleBinding 列表 */
export const getKubeRoleBindings = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/rolebindings`));
};

/** 查询 RoleBinding YAML */
export const getKubeRoleBinding = (id: number, ns: string, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/rolebindings/${name}`));
};

/** 创建 RoleBinding */
export const createKubeRoleBinding = (id: number, ns: string, name: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/rolebindings`), { data });
};

/** 更新 RoleBinding */
export const updateKubeRoleBinding = (id: number, ns: string, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/rolebindings/${name}`), { data });
};

/** 删除 RoleBinding */
export const deleteKubeRoleBinding = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/rolebindings/${name}`));
};

/** 批量删除 RoleBinding */
export const batchDeleteKubeRoleBindings = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/rolebindings/batch-delete`), { data });
};

/** ---------- IAM ClusterRoleBinding（集群级） ---------- */
/** 查询 ClusterRoleBinding 列表 */
export const getClusterRoleBindings = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/clusterrolebindings`));
};

/** 查询 ClusterRoleBinding YAML */
export const getClusterRoleBinding = (id: number, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/clusterrolebindings/${name}`));
};

/** 创建 ClusterRoleBinding */
export const createClusterRoleBinding = (id: number, name: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/clusterrolebindings`), { data });
};

/** 更新 ClusterRoleBinding */
export const updateClusterRoleBinding = (id: number, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/clusterrolebindings/${name}`), { data });
};

/** 删除 ClusterRoleBinding */
export const deleteClusterRoleBinding = (id: number, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/clusterrolebindings/${name}`));
};

/** 批量删除 ClusterRoleBinding */
export const batchDeleteClusterRoleBindings = (id: number, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/clusterrolebindings/batch-delete`), { data });
};

/** 查询 Secret 列表 */
export const getSecrets = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/secrets`));
};

/** 查询 Secret YAMl */
export const getSecret = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/secrets/${name}`));
};

/** 创建 Secret */
export const createSecret = (id: number, ns, name: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/secrets`), {data});
};

/** 更新 Secret  */
export const updateSecret = (id: number, ns, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/secrets/${name}`), {data});
};

/** 删除 Secret */
export const deleteSecret = (id: number, ns, name: string) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/secrets/${name}`));
};

/** 批量删除 Secret */
export const batchDeleteSecrets = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/secrets/batch-delete`), { data });
};

/** 获取 StorageClass 列表 */
export const getStorageClasses = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/storageclass`));
};

/** 查询 StorageClass YAMl */
export const getStorageClass = (id: number, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/storageclass/${name}`));
};

/** 创建 StorageClass */
export const createStorageClass = (id: number, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/storageclass`), {data});
};

/** 更新 StorageClass  */
export const updateStorageClass = (id: number, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/storageclass/${name}`), {data});
};

/** 删除 StorageClass */
export const deleteStorageClass = (id: number, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/storageclass/${name}`));
};

/** 批量删除 StorageClass */
export const batchDeleteStorageClasses = (id: number, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/storageclass/batch-delete`), { data });
};

/** 获取 PersistentVolume 列表 */
export const getPersistentVolumes = (id: number) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/persistentvolumes`));
};


/** 查询 PersistentVolume YAMl */
export const getPersistentVolume = (id: number, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/persistentvolumes/${name}`));
};

/** 创建 PersistentVolume */
export const createPersistentVolume = (id: number, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/persistentvolumes`), {data});
};

/** 更新 PersistentVolume  */
export const updatePersistentVolume = (id: number, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/persistentvolumes/${name}`), {data});
};

/** 删除 PersistentVolume */
export const deletePersistentVolume = (id: number, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/persistentvolumes/${name}`));
};

/** 批量删除 PersistentVolume */
export const batchDeletePersistentVolumes = (id: number, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/persistentvolumes/batch-delete`), { data });
};

/** 获取 PersistentVolumeClaim 列表 */
export const getPersistentVolumeClaims = (id: number, ns: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/persistentvolumeclaims`));
};


/** 查询 PersistentVolumeClaim YAMl */
export const getPersistentVolumeClaim = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/persistentvolumes/${name}`));
};

/** 创建 PersistentVolumeClaim */
export const createPersistentVolumeClaim = (id: number, ns: string, data: any) => {
  return http.request("post", kubeUrlApi(`clusters/${id}/namespaces/${ns}/persistentvolumes`), {data});
};

/** 更新 PersistentVolumeClaim  */
export const updatePersistentVolumeClaim = (id: number, ns: string, name: string, data: any) => {
  return http.request("patch", kubeUrlApi(`clusters/${id}/namespaces/${ns}/persistentvolumes/${name}`), {data});
};

/** 删除 PersistentVolumeClaim */
export const deletePersistentVolumeClaim = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/persistentvolumes/${name}`));
};

/** 批量删除 PersistentVolumeClaim */
export const batchDeletePersistentVolumeClaims = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/persistentvolumes/batch-delete`), { data });
};

/** 查询 ReplicaSets 列表 */
export const getReplicaSets = (id, ns: string, params?: any) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/replicasets`), {params});
};

/** 删除 ReplicaSet */
export const deleteReplicaSet = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/replicasets/${name}`));
};

/** 批量删除 ReplicaSet */
export const batchDeleteReplicaSets = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/replicasets/batch-delete`), { data });
};

/** 查询 Pod 列表 */
export const getPods = (id: number, ns: string, params?: any) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods`), {params});
};

/** 查询 Pod YAMl  */
export const getPod = (id: number, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods/${name}`));
};

/** 删除 Pod */
export const deletePod = (id: number, ns: string, name: string) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods/${name}`));
};

/** 批量删除 Pod */
export const batchDeletePods = (id: number, ns: string, data: { names: string[] }) => {
  return http.request("delete", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods/batch-delete`), { data });
};

/** 查询 Pod  详情 */
export const getPodDetail = (id: string, ns, name: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods/${name}/detail`));
};

/** 查询 Pod Terminal(校验权限) */
export const getPodTerminal = (id, ns, name, container: string) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods/${name}/containers/${container}/exec`));
};

export const getLogs = (id: string, ns, name, container: any, params?: Record<string, string>) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pods/${name}/containers/${container}/logs`), {params: params});
};

/** 查询 Events 信息 */
export const getEvents = (id: string, ns: string, params?: Record<string, string>) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/events`), {params: params});
};

/** 查询 Tasks 列表 */
export const getTasks = (id: string, ns: string, params?: Record<string, string>) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/tasks`), {params: params});
};

/** 查询 Tasks 列表 */
export const getTektonPipelines = (id: string, ns: string, params?: Record<string, string>) => {
  return http.request("get", kubeUrlApi(`clusters/${id}/namespaces/${ns}/pipelines`), {params: params});
};
