import type { AuthenticatedSession } from "./authService";
import { associateSessionDraftAccount } from "./sessionDraftStorage";
import { publishAuthMessage } from "./authBroadcast";
import { useAuthStore } from "../stores/authStore";

export function establishClientSession(current: AuthenticatedSession): void {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  associateSessionDraftAccount(current.user.id);
  useAuthStore.getState().login(current.user, current.session);
  publishAuthMessage({
    type: "ACCOUNT_CHANGED",
    userId: current.user.id,
  });
}
