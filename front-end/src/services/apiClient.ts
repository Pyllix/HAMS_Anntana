import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../stores/authStore";
import { canStartApiRequest } from "./sessionRequestPolicy.js";

export const API_BASE_PATH = "/api";
const RENDER_API_HOST = "hams-anntana.onrender.com";

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

function rewriteLegacyApiUrl(config: InternalAxiosRequestConfig): void {
  if (!config.url) return;

  try {
    const url = new URL(config.url);
    if (url.hostname !== RENDER_API_HOST) return;

    const path = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
    config.url = API_BASE_PATH + path + url.search;
    config.baseURL = undefined;
  } catch {
    // Relative URLs already use the same origin.
  }
}

function apiPath(config: InternalAxiosRequestConfig): string | null {
  const url = config.url ?? "";
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
  rewriteLegacyApiUrl(config);

  const authorization = config.headers.get("Authorization");
  if (
    typeof authorization === "string" &&
    /^Bearer\s+(null|undefined)$/i.test(authorization)
  ) {
    config.headers.delete("Authorization");
  }

  const method = (config.method ?? "get").toUpperCase();
  const path = apiPath(config);
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
  if (
    error.response?.status === 401 &&
    responseData?.code === "SESSION_EXPIRED" &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event("hams:session-expired"));
  }
  return Promise.reject(error);
}

function configureClient(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use(prepareRequest);
  client.interceptors.response.use((response) => response, handleResponseError);
  return client;
}

// Legacy services still import Axios directly. Normalize their API URLs and
// attach cookies/CSRF here until Ticket 11 removes those call-site tokens.
configureClient(axios);
export const apiClient = configureClient(
  axios.create({ baseURL: API_BASE_PATH, withCredentials: true }),
);