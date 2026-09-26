import type { AxiosError } from "axios";
import type { User } from "../types/TypeUser";
import { apiClient, invalidateCsrfToken } from "./apiClient";

export interface SessionDeadlines {
  id: string;
  userId: string;
  expiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

interface SessionResponse {
  session: SessionDeadlines | null;
  user?: { id: string; email?: string; role?: string };
}

interface SignInResponse {
  requiresTwoFactor?: boolean;
  user?: { id: string };
}

export interface AuthenticatedSession {
  user: User;
  session: SessionDeadlines;
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

function twoFactorRequiredError(): Error & { code: string } {
  return Object.assign(
    new Error("This account needs a two-factor sign-in flow"),
    { code: "TWO_FACTOR_REQUIRED" },
  );
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
): Promise<AuthenticatedSession> {
  invalidateCsrfToken();
  const signInResponse = await apiClient.post<SignInResponse>("/auth/sign-in", {
    email,
    password,
  });
  const signIn = signInResponse.data;

  if (signIn.requiresTwoFactor) throw twoFactorRequiredError();
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
  return {
    user,
    session,
  };
}

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const response = await apiClient.get<SessionResponse>("/auth/session");
  const { session, user: sessionUser } = response.data;
  if (!session || !sessionUser?.id || session.userId !== sessionUser.id) return null;

  const user = await loadUser(session.userId);
  return {
    user,
    session,
  };
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