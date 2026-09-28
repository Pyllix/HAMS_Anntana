const PUBLIC_SESSION_REQUESTS = new Set([
  "GET /auth/csrf",
  "GET /auth/session",
  "POST /auth/sign-in",
  "POST /auth/sign-out",
]);

export function canStartApiRequest(
  method: string,
  path: string | undefined,
  isAuthenticated: boolean,
  allowUnauthenticated = false,
): boolean {
  if (!path || allowUnauthenticated) return true;
  const requestKey = method.toUpperCase() + " " + path;
  return PUBLIC_SESSION_REQUESTS.has(requestKey) || isAuthenticated;
}

export function isSessionExpiredResponse(
  status: number | undefined,
  code: string | undefined,
): boolean {
  return status === 401 && code === "SESSION_EXPIRED";
}
