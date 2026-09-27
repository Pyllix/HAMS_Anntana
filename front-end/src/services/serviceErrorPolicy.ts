import { isSessionExpiredResponse } from "./sessionRequestPolicy.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSessionExpiredApiError(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error.response)) return false;
  const response = error.response;
  if (!isRecord(response.data)) return false;

  return isSessionExpiredResponse(
    typeof response.status === "number" ? response.status : undefined,
    typeof response.data.code === "string" ? response.data.code : undefined,
  );
}
