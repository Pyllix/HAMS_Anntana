import { isSessionExpiredResponse } from "./sessionRequestPolicy.js";

/** @param {unknown} error */
export function isSessionExpiredApiError(error) {
  if (typeof error !== "object" || error === null) return false;
  const response = error.response;
  if (typeof response !== "object" || response === null) return false;
  const data = response.data;
  return (
    typeof data === "object" &&
    data !== null &&
    isSessionExpiredResponse(response.status, data.code)
  );
}