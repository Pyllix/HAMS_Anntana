import axios, {
  AxiosError,
  type AxiosInstance,
  type CreateAxiosDefaults,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../stores/authStore";
import { canStartApiRequest } from "./sessionRequestPolicy";
import { dispatchSessionExpiryIfNeeded } from "./sessionExpiryFlow";

export const API_BASE_PATH = "/api";

declare module "axios" {
  interface AxiosRequestConfig {
    allowUnauthenticated?: boolean;
  }

  interface InternalAxiosRequestConfig {
    allowUnauthenticated?: boolean;
  }
}

type CsrfResponse = { csrfToken?: string };
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = axios
      .get<CsrfResponse>(API_BASE_PATH + "/auth/csrf", {
        withCredentials: true,
      })
      .then(({ data }) => {
        if (!data.csrfToken) throw new Error("The server did not issue a CSRF token");
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

export function invalidateCsrfToken(): void {
  csrfToken = null;
}

function apiPath(config: InternalAxiosRequestConfig): string | null {
  const url = config.url ?? "";
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url)) return null;
  if (config.baseURL === API_BASE_PATH) {
    return url.split("?", 1)[0] || "/";
  }
  if (url === API_BASE_PATH || url.startsWith(API_BASE_PATH + "/")) {
    return url.slice(API_BASE_PATH.length).split("?", 1)[0] || "/";
  }
  return null;
}

async function prepareRequest(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  config.withCredentials = true;

  const method = (config.method ?? "get").toUpperCase();
  const path = apiPath(config);
  if (path === null) {
    throw new AxiosError(
      "Browser API requests must use the same-origin /api path",
      "ERR_BAD_REQUEST",
      config,
    );
  }
  config.headers.delete("Authorization");
  if (
    !canStartApiRequest(
      method,
      path,
      useAuthStore.getState().isAuthenticated,
      config.allowUnauthenticated,
    )
  ) {
    throw new AxiosError(
      "A server-confirmed session is required for this request",
      "ERR_CANCELED",
      config,
    );
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    config.headers.set("X-CSRF-Token", await getCsrfToken());
  }

  return config;
}

function handleResponseError(error: AxiosError): Promise<never> {
  const responseData = error.response?.data as { code?: string } | undefined;
  if (typeof window !== "undefined") {
    dispatchSessionExpiryIfNeeded(
      window,
      error.response?.status,
      responseData?.code,
    );
  }
  return Promise.reject(error);
}

function configureClient(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use(prepareRequest);
  client.interceptors.response.use((response) => response, handleResponseError);
  return client;
}

// Keep legacy Axios imports on the same-origin cookie client while services
// continue moving to this explicit API client.
export function createApiClient(
  options: Omit<CreateAxiosDefaults, "baseURL" | "withCredentials"> = {},
): AxiosInstance {
  return configureClient(
    axios.create({ ...options, baseURL: API_BASE_PATH, withCredentials: true }),
  );
}

// Existing services using the default Axios export inherit the same transition
// rules while Ticket 11 moves their call sites to this explicit factory.
configureClient(axios);
export const apiClient = createApiClient();
