import { isSessionExpiredResponse } from "./sessionRequestPolicy.ts";

export const SESSION_EXPIRED_EVENT = "hams:session-expired";

export function dispatchSessionExpiryIfNeeded(
  target: EventTarget,
  status: number | undefined,
  code: string | undefined,
): boolean {
  if (!isSessionExpiredResponse(status, code)) return false;
  target.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return true;
}

export function subscribeToSessionExpiry(
  target: EventTarget,
  handler: EventListener,
): () => void {
  target.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => target.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

interface SessionExpiryActions {
  isAuthenticated: () => boolean;
  hideWarning: () => void;
  clearSession: (options: { broadcast: { type: "SESSION_EXPIRED" } }) => void;
}

export function createSessionExpiryHandler(
  actions: SessionExpiryActions,
): () => void {
  return () => {
    if (!actions.isAuthenticated()) return;
    actions.hideWarning();
    actions.clearSession({ broadcast: { type: "SESSION_EXPIRED" } });
  };
}
