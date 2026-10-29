import { isAxiosError, type AxiosError } from "axios";
import type { User } from "../types/TypeUser";
import type { PreAuthStep } from "../types/AuthFlow";
import { apiClient, invalidateCsrfToken } from "./apiClient";
import { restoreServerSession } from "./sessionBootstrap";

export interface SessionDeadlines {
  id: string;
  userId: string;
  expiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

interface SessionResponse {
  session: SessionDeadlines | null;
  user?: {
    id: string;
    email?: string;
    role?: string;
    enrollmentComplete?: boolean;
  };
  twoFactorRequired?: boolean;
}

interface SignInResponse {
  requiresTwoFactor?: boolean;
  twoFactorRedirect?: string;
  user?: { id: string };
}

export interface AuthenticatedSession {
  user: User;
  session: SessionDeadlines;
}

export type AuthLoginResult =
  | { kind: "authenticated"; user: User; session: SessionDeadlines }
  | { kind: "pre-auth"; step: PreAuthStep };

export type AuthInitializationState =
  | { kind: "authenticated"; user: User; session: SessionDeadlines }
  | { kind: "pre-auth"; step: PreAuthStep }
  | { kind: "anonymous" };

function preAuthStepForRedirect(redirect?: string): PreAuthStep | null {
  if (redirect === "/2fa/enroll") return "ENROLLMENT";
  if (redirect === "/2fa/verify") return "TOTP";
  return null;
}

function authenticatedResult(current: AuthenticatedSession) {
  return { kind: "authenticated" as const, ...current };
}

export function isEmailVerificationRequired(error: unknown): boolean {
  return (
    isAxiosError<{ code?: string }>(error) &&
    error.response?.status === 403 &&
    error.response.data?.code === "EMAIL_NOT_VERIFIED"
  );
}

export function getLoginErrorMessage(error: unknown): string {
  const value = error as AxiosError<{ code?: string }> & {
    code?: string;
    response?: { status?: number; data?: { code?: string } };
  };

  if (value.code === "TWO_FACTOR_REQUIRED") {
    return "บัญชีนี้ต้องยืนยัน 2FA ก่อนเข้าใช้งาน กรุณาใช้หน้าจอยืนยัน 2FA";
  }
  if (value.response?.data?.code === "SESSION_EXPIRED") {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
  }
  if (isEmailVerificationRequired(error)) {
    return "อีเมลนี้ยังไม่ได้รับการยืนยัน กรุณาตรวจสอบกล่องข้อความและโฟลเดอร์สแปม";
  }
  if (!value.response) {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง";
  }
  if (value.response.status === 401) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (value.response.status === 429) {
    return "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง";
  }
  return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export function getVerificationEmailErrorMessage(error: unknown): string {
  if (isAxiosError(error) && !error.response) {
    return "เชื่อมต่อไม่ได้ กรุณาลองใหม่";
  }
  if (isAxiosError(error) && error.response?.status === 429) {
    return "กรุณารอก่อนขออีเมลใหม่";
  }
  if (isAxiosError(error) && error.response?.status === 400) {
    return "ส่งไม่ได้ กรุณาลองเข้าสู่ระบบอีกครั้ง";
  }
  return "ส่งไม่สำเร็จ กรุณาลองใหม่";
}

export function getVerificationEmailRetryDelay(error: unknown): number {
  if (!isAxiosError(error) || error.response?.status !== 429) return 0;

  const bodyDelay = error.response.data?.retryAfterSeconds;
  const retryAfter = error.response.headers["retry-after"];
  if (typeof retryAfter === "string" || typeof retryAfter === "number") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);

    const retryAt = Date.parse(String(retryAfter));
    if (Number.isFinite(retryAt) && retryAt > Date.now()) {
      return Math.ceil((retryAt - Date.now()) / 1000);
    }
  }
  return typeof bodyDelay === "number" && Number.isFinite(bodyDelay) && bodyDelay > 0
    ? Math.ceil(bodyDelay)
    : 300;
}

export async function sendVerificationEmail(email: string): Promise<number> {
  const response = await apiClient.post<{ status: boolean; retryAfterSeconds?: number }>(
    "/auth/send-verification-email",
    { email: email.trim() },
    { allowUnauthenticated: true },
  );
  if (response.data?.status !== true) {
    throw new Error("The server did not confirm the verification email request");
  }
  const delay = response.data.retryAfterSeconds;
  return typeof delay === "number" && Number.isFinite(delay) && delay > 0
    ? Math.max(300, Math.ceil(delay))
    : 300;
}

export function getTwoFactorErrorMessage(error: unknown): string {
  const value = error as AxiosError<{
    code?: string;
    retryAfterSeconds?: number;
  }> & {
    code?: string;
    response?: {
      status?: number;
      data?: { code?: string; retryAfterSeconds?: number };
    };
  };
  const code = value.response?.data?.code ?? value.code;
  const retryAfterSeconds = value.response?.data?.retryAfterSeconds;

  if (code === "TOTP_LOCKED") {
    const minutes = retryAfterSeconds
      ? Math.max(1, Math.ceil(retryAfterSeconds / 60))
      : 10;
    return `ยืนยันไม่สำเร็จหลายครั้ง บัญชีถูกพักชั่วคราว กรุณารอประมาณ ${minutes} นาทีแล้วลองใหม่`;
  }
  if (code === "INVALID_TOTP_CODE") {
    return "รหัสจากแอป Authenticator ไม่ถูกต้องหรือหมดอายุ กรุณารอรหัสใหม่แล้วลองอีกครั้ง";
  }
  if (code === "INVALID_RECOVERY_CODE") {
    return "Recovery Code ไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาตรวจสอบรหัสที่ยังไม่เคยใช้";
  }
  if (code === "ALL_RECOVERY_CODES_USED") {
    return "Recovery Code ถูกใช้ครบแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ต 2FA";
  }
  if (
    code === "RECOVERY_CODES_ALREADY_ISSUED" ||
    code === "RECOVERY_CODES_NOT_SHOWN" ||
    code === "RECOVERY_CODES_NOT_ACKNOWLEDGED"
  ) {
    return "Recovery Codes ชุดนี้แสดงได้ครั้งเดียว หากออกจากหน้านี้ก่อนยืนยัน จะเปิดดูซ้ำไม่ได้ กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ต 2FA";
  }
  if (code === "INVALID_PASSWORD") {
    return "รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
  }
  if (code === "ALREADY_ENROLLED") {
    return "บัญชีนี้ตั้งค่า 2FA แล้ว กรุณาออกจากระบบและเข้าสู่ระบบใหม่";
  }
  if (!value.response) {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
  }
  return "ดำเนินการ 2FA ไม่สำเร็จ กรุณาลองอีกครั้ง";
}

async function loadUser(userId: string): Promise<User> {
  const response = await apiClient.get<User>("/users/" + encodeURIComponent(userId), {
    allowUnauthenticated: true,
  });
  return response.data;
}

export async function authLogin(
  email: string,
  password: string,
): Promise<AuthLoginResult> {
  invalidateCsrfToken();
  const signInResponse = await apiClient.post<SignInResponse>("/auth/sign-in", {
    email,
    password,
  });
  const signIn = signInResponse.data;
  invalidateCsrfToken();

  if (signIn.requiresTwoFactor) {
    const step = preAuthStepForRedirect(signIn.twoFactorRedirect);
    if (!step) throw new Error("The server returned an unknown two-factor flow");
    return { kind: "pre-auth", step };
  }
  if (!signIn.user?.id) throw new Error("The server did not return a signed-in user");

  const [sessionResponse, user] = await Promise.all([
    apiClient.get<SessionResponse>("/auth/session"),
    loadUser(signIn.user.id),
  ]);
  const { session } = sessionResponse.data;
  if (!session || session.userId !== user.id) {
    throw new Error("The server did not establish the expected session");
  }

  invalidateCsrfToken();
  return authenticatedResult({ user, session });
}

export async function getCurrentAuthState(): Promise<AuthInitializationState> {
  const response = await apiClient.get<SessionResponse>("/auth/session");
  const context = response.data;

  if (context.session && context.user?.id === context.session.userId) {
    const user = await loadUser(context.session.userId);
    if (user?.id === context.session.userId) {
      return authenticatedResult({ user, session: context.session });
    }
    return { kind: "anonymous" };
  }

  if (!context.session && context.user?.id) {
    if (context.user.enrollmentComplete === false) {
      return { kind: "pre-auth", step: "ENROLLMENT" };
    }
    if (context.twoFactorRequired === true || context.user.enrollmentComplete === true) {
      return { kind: "pre-auth", step: "TOTP" };
    }
  }

  return { kind: "anonymous" };
}

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  return (await restoreServerSession(
    () => apiClient.get<SessionResponse>("/auth/session"),
    loadUser,
  )) as AuthenticatedSession | null;
}

export async function enableTwoFactor(password: string): Promise<string> {
  const response = await apiClient.post<{ totpURI: string }>(
    "/auth/2fa/enable",
    { password },
    { allowUnauthenticated: true },
  );
  if (!response.data.totpURI?.startsWith("otpauth://")) {
    throw new Error("The server did not return a valid authenticator URI");
  }
  return response.data.totpURI;
}

export async function verifyTwoFactorSetup(code: string): Promise<string[]> {
  const response = await apiClient.post<{ backupCodes: string[] }>(
    "/auth/2fa/verify-setup",
    { code },
    { allowUnauthenticated: true },
  );
  invalidateCsrfToken();
  return response.data.backupCodes;
}

export async function acknowledgeRecoveryCodes(): Promise<void> {
  await apiClient.post(
    "/auth/2fa/acknowledge-recovery-codes",
    { acknowledged: true },
    { allowUnauthenticated: true },
  );
  invalidateCsrfToken();
}

export async function verifyTotpAtLogin(
  code: string,
  trustBrowser = false,
): Promise<void> {
  await apiClient.post(
    "/auth/2fa/verify-totp",
    { code, trustBrowser },
    { allowUnauthenticated: true },
  );
  invalidateCsrfToken();
}

export async function verifyRecoveryCodeAtLogin(
  code: string,
  trustBrowser = false,
): Promise<void> {
  await apiClient.post(
    "/auth/2fa/verify-recovery-code",
    { code, trustBrowser },
    { allowUnauthenticated: true },
  );
  invalidateCsrfToken();
}

export async function refreshSessionWindow(
  userActivity: boolean,
): Promise<SessionDeadlines | null> {
  const response = await apiClient.get<SessionResponse>("/auth/session", {
    headers: userActivity ? { "X-User-Activity": "1" } : undefined,
  });
  return response.data.session;
}

export async function revokeCurrentSession(): Promise<void> {
  await apiClient.post("/auth/sign-out");
  invalidateCsrfToken();
}
