import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/authStore";
import { refreshSessionWindow } from "../../services/authService";
import {
  clearSessionDrafts,
  hasSessionDrafts,
  hasSessionDraftAccountChanged,
} from "../../services/sessionDraftStorage.js";
import {
  publishAuthMessage,
  subscribeAuthMessages,
} from "../../services/authBroadcast";
import type { AuthBroadcastMessage } from "../../services/authBroadcast";

const WARNING_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const ACTIVITY_REFRESH_INTERVAL_MS = 15 * 1000;
let redirectingToLogin = false;

function redirectToLogin(): void {
  if (window.location.pathname !== "/login") {
    redirectingToLogin = true;
    window.location.replace("/login");
  }
}

interface ClearSessionOptions {
  clearDrafts?: boolean;
  broadcast?: AuthBroadcastMessage;
}

function clearClientSession(
  queryClient: QueryClient,
  options: ClearSessionOptions = {},
): void {
  if (options.clearDrafts) clearSessionDrafts();
  queryClient.clear();
  useAuthStore.getState().logout();
  if (options.broadcast) publishAuthMessage(options.broadcast);
  redirectToLogin();
}

export default function SessionLifecycle() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const updateSession = useAuthStore((state) => state.updateSession);
  const [showWarning, setShowWarning] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [continueError, setContinueError] = useState("");
  const lastActivityRefreshAt = useRef(0);
  const pendingActivityRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleWindowExpiry = () => {
      if (!useAuthStore.getState().isAuthenticated) return;
      setShowWarning(false);
      clearClientSession(queryClient, {
        broadcast: { type: "SESSION_EXPIRED" },
      });
    };

    const unsubscribe = subscribeAuthMessages((message) => {
      const currentUserId = useAuthStore.getState().user?.id;
      if (message.type === "SESSION_EXPIRED") {
        clearClientSession(queryClient);
      } else if (message.type === "SIGNED_OUT") {
        clearClientSession(queryClient, { clearDrafts: true });
      } else if (
        message.type === "ACCOUNT_CHANGED" &&
        hasSessionDraftAccountChanged(currentUserId, message.userId)
      ) {
        clearClientSession(queryClient, { clearDrafts: true });
      }
    });

    window.addEventListener("hams:session-expired", handleWindowExpiry);
    return () => {
      window.removeEventListener("hams:session-expired", handleWindowExpiry);
      unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !session?.expiresAt) {
      setShowWarning(false);
      return;
    }

    const expiresAt = Date.parse(session.expiresAt);
    if (!Number.isFinite(expiresAt)) return;

    const now = Date.now();
    if (expiresAt - now > WARNING_BEFORE_EXPIRY_MS) setShowWarning(false);
    const warningTimer = setTimeout(
      () => setShowWarning(true),
      Math.max(0, expiresAt - WARNING_BEFORE_EXPIRY_MS - now),
    );
    const expiryTimer = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) return;

      void refreshSessionWindow(false)
        .then((latest) => {
          if (!latest) {
            window.dispatchEvent(new Event("hams:session-expired"));
            return;
          }

          const currentUser = useAuthStore.getState().user;
          if (!currentUser || latest.userId !== currentUser.id) {
            clearClientSession(queryClient, {
              clearDrafts: true,
              broadcast: latest.userId
                ? { type: "ACCOUNT_CHANGED", userId: latest.userId }
                : undefined,
            });
            return;
          }

          useAuthStore.getState().updateSession(latest);
        })
        .catch(() => {
          window.dispatchEvent(new Event("hams:session-expired"));
        });
    }, Math.max(0, expiresAt - now));

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);
    };
  }, [isAuthenticated, queryClient, session?.expiresAt]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let active = true;
    const clearForSessionMismatch = (newUserId?: string) => {
      clearClientSession(queryClient, {
        clearDrafts: Boolean(newUserId),
        broadcast: newUserId
          ? { type: "ACCOUNT_CHANGED", userId: newUserId }
          : { type: "SESSION_EXPIRED" },
      });
    };

    const refreshForActivity = async () => {
      lastActivityRefreshAt.current = Date.now();
      try {
        const refreshed = await refreshSessionWindow(true);
        if (!active) return;
        if (!refreshed) {
          clearForSessionMismatch();
          return;
        }
        if (refreshed.userId !== user.id) {
          clearForSessionMismatch(refreshed.userId);
          return;
        }
        updateSession(refreshed);
        setContinueError("");
      } catch {
        // Keep the server-issued deadline; the expiry timer will fail closed.
      }
    };

    const onUserActivity = (event: Event) => {
      if (!event.isTrusted || document.hidden) return;
      const elapsed = Date.now() - lastActivityRefreshAt.current;
      if (elapsed >= ACTIVITY_REFRESH_INTERVAL_MS) {
        void refreshForActivity();
      } else if (!pendingActivityRefresh.current) {
        pendingActivityRefresh.current = setTimeout(() => {
          pendingActivityRefresh.current = null;
          if (!document.hidden && active) void refreshForActivity();
        }, ACTIVITY_REFRESH_INTERVAL_MS - elapsed);
      }
    };

    const onVisibilityChange = async () => {
      if (document.hidden) return;
      try {
        const refreshed = await refreshSessionWindow(false);
        if (!active) return;
        if (!refreshed) {
          clearForSessionMismatch();
          return;
        }
        if (refreshed.userId !== user.id) {
          clearForSessionMismatch(refreshed.userId);
          return;
        }
        updateSession(refreshed);
      } catch {
        // A passive visibility check never counts as user activity.
      }
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (redirectingToLogin || !hasSessionDrafts(user.id)) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("pointerdown", onUserActivity, true);
    window.addEventListener("keydown", onUserActivity, true);
    window.addEventListener("wheel", onUserActivity, true);
    window.addEventListener("scroll", onUserActivity, true);
    window.addEventListener("touchstart", onUserActivity, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      active = false;
      if (pendingActivityRefresh.current) {
        clearTimeout(pendingActivityRefresh.current);
        pendingActivityRefresh.current = null;
      }
      window.removeEventListener("pointerdown", onUserActivity, true);
      window.removeEventListener("keydown", onUserActivity, true);
      window.removeEventListener("wheel", onUserActivity, true);
      window.removeEventListener("scroll", onUserActivity, true);
      window.removeEventListener("touchstart", onUserActivity, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isAuthenticated, queryClient, updateSession, user?.id]);

  const continueSession = async () => {
    if (!user?.id) return;
    setIsContinuing(true);
    setContinueError("");
    try {
      const refreshed = await refreshSessionWindow(true);
      if (!refreshed) {
        clearClientSession(queryClient, {
          broadcast: { type: "SESSION_EXPIRED" },
        });
        return;
      }
      if (refreshed.userId !== user.id) {
        clearClientSession(queryClient, {
          clearDrafts: true,
          broadcast: { type: "ACCOUNT_CHANGED", userId: refreshed.userId },
        });
        return;
      }
      updateSession(refreshed);
      setShowWarning(false);
    } catch {
      setContinueError("ต่ออายุเซสชันไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    } finally {
      setIsContinuing(false);
    }
  };

  if (!isAuthenticated || !showWarning) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-[10000] max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xl"
    >
      <p className="font-semibold text-amber-950">เซสชันใกล้หมดอายุ</p>
      <p className="mt-1 text-sm text-amber-900">
        เซสชันจะหมดเมื่อไม่มีการใช้งานครบ 60 นาที และสิ้นสุดสูงสุด 12 ชั่วโมงหลังเข้าสู่ระบบ
        การใช้งานต่อจะเลื่อนเฉพาะเวลา idle
      </p>
      {continueError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {continueError}
        </p>
      )}
      <button
        type="button"
        onClick={() => void continueSession()}
        disabled={isContinuing}
        className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
      >
        {isContinuing ? "กำลังต่อเวลา..." : "ใช้งานต่อ"}
      </button>
    </div>
  );
}
