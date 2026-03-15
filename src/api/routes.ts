import { http } from "@/utils/http";
import { authnUrlApi } from "./utils";

type Result = {
  success: boolean;
  data: Array<any>;
};

export const getAsyncRoutes = () => {
  return http.request<Result>("get", authnUrlApi("/me/routes"));
};
