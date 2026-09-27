import { isSessionExpiredResponse } from "./sessionRequestPolicy.js";

export const SESSION_EXPIRED_EVENT = "hams:session-expired";

/**
 * @param {EventTarget} target
 * @param {number | undefined} status
 * @param {string | undefined} code
 */
export function dispatchSessionExpiryIfNeeded(target, status, code) {
  if (!isSessionExpiredResponse(status, code)) return false;
  target.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return true;
}

/**
 * @param {EventTarget} target
 * @param {EventListener} handler
 */
export function subscribeToSessionExpiry(target, handler) {
  target.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => target.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

/**
 * @param {{
 *   isAuthenticated: () => boolean,
 *   hideWarning: () => void,
 *   clearSession: (options: { broadcast: { type: "SESSION_EXPIRED" } }) => void,
 * }} actions
 */
export function createSessionExpiryHandler(actions) {
  return () => {
    if (!actions.isAuthenticated()) return;
    actions.hideWarning();
    actions.clearSession({ broadcast: { type: "SESSION_EXPIRED" } });
  };
}