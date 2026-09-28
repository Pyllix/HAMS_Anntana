import { apiClient, invalidateCsrfToken } from "./apiClient";
import { useAuthStore } from "../stores/authStore";

export interface TwoFactorStatus {
  enrolled: boolean;
  required: boolean;
}

export interface AdminStepUpResponse {
  expiresAt: string;
}

const ADMIN_STEP_UP_TTL_MS = 5 * 60 * 1000;
const adminStepUpExpiries = new Map<string, number>();

function currentAdminSessionKey(): string | null {
  const { user, role, session, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || role !== "ADMIN" || !user?.id || !session?.id) {
    return null;
  }
  return `${user.id}:${session.id}`;
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const response = await apiClient.get<TwoFactorStatus>("/auth/2fa/status");
  return response.data;
}

export async function startAuthenticatorReplacement(
  currentPassword: string,
  currentTotpCode: string,
): Promise<string> {
  const response = await apiClient.post<{ totpURI: string }>(
    "/auth/2fa/replace-authenticator",
    { currentPassword, currentTotpCode },
  );
  clearAdminStepUp();
  if (!response.data.totpURI?.startsWith("otpauth://")) {
    throw new Error("The server did not return a valid authenticator URI");
  }
  return response.data.totpURI;
}

export async function verifyAuthenticatorReplacement(code: string): Promise<void> {
  await apiClient.post("/auth/2fa/verify-authenticator-replacement", { code });
  invalidateCsrfToken();
  clearAdminStepUp();
}

export async function regenerateRecoveryCodes(code: string): Promise<string[]> {
  const response = await apiClient.post<{ recoveryCodes: string[] }>(
    "/auth/2fa/regenerate-recovery-codes",
    { code },
  );
  clearAdminStepUp();
  if (!Array.isArray(response.data.recoveryCodes)) {
    throw new Error("The server did not return recovery codes");
  }
  return response.data.recoveryCodes;
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post("/auth/change-password", {
    currentPassword,
    newPassword,
  });
  invalidateCsrfToken();
  clearAdminStepUp();
}

export async function createAdminStepUp(code: string): Promise<string> {
  const response = await apiClient.post<AdminStepUpResponse>(
    "/auth/step-up/totp",
    { code },
  );
  rememberAdminStepUp(response.data.expiresAt);
  return response.data.expiresAt;
}

export async function adminResetPassword(
  userId: string,
  newPassword: string,
): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>(
    `/users/${encodeURIComponent(userId)}/reset-password`,
    { newPassword },
  );
  if (useAuthStore.getState().user?.id === userId) clearAdminStepUp();
  return response.data;
}

export async function adminResetTwoFactor(
  userId: string,
  reason: string,
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/users/${encodeURIComponent(userId)}/reset-2fa`,
    { reason, identityVerifiedOutsideHams: true },
  );
  return response.data;
}

export function rememberAdminStepUp(
  expiresAt: string,
  now = Date.now(),
): void {
  const key = currentAdminSessionKey();
  const expiration = Date.parse(expiresAt);
  if (!key || !Number.isFinite(expiration) || expiration <= now) return;
  adminStepUpExpiries.set(key, Math.min(expiration, now + ADMIN_STEP_UP_TTL_MS));
}

export function getAdminStepUpExpiry(now = Date.now()): number | null {
  const key = currentAdminSessionKey();
  if (!key) return null;
  const expiration = adminStepUpExpiries.get(key);
  if (!expiration || expiration <= now) {
    adminStepUpExpiries.delete(key);
    return null;
  }
  return expiration;
}

export function isAdminStepUpActive(now = Date.now()): boolean {
  return getAdminStepUpExpiry(now) !== null;
}

export function clearAdminStepUp(): void {
  const key = currentAdminSessionKey();
  if (key) adminStepUpExpiries.delete(key);
}
