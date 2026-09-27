import type { AuthenticatedSession } from "./authService";
import { associateSessionDraftAccount } from "./sessionDraftStorage";
import { publishAuthMessage } from "./authBroadcast";
import { useAuthStore } from "../stores/authStore";
import { clearLegacyBrowserAuthStorage } from "./legacyAuthStorage";

export function establishClientSession(current: AuthenticatedSession): void {
  clearLegacyBrowserAuthStorage();
  associateSessionDraftAccount(current.user.id);
  useAuthStore.getState().login(current.user, current.session);
  publishAuthMessage({
    type: "ACCOUNT_CHANGED",
    userId: current.user.id,
  });
}
