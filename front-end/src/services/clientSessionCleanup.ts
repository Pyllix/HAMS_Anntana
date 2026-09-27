import type { QueryClient } from "@tanstack/react-query";
import type { AuthBroadcastMessage } from "./authBroadcast";

interface ClearSessionOptions {
  clearDrafts?: boolean;
  broadcast?: AuthBroadcastMessage;
}

interface ClearSessionActions {
  clearDrafts: () => void;
  logout: () => void;
  publish: (message: AuthBroadcastMessage) => void;
  redirectToLogin: () => void;
}

export function clearClientSessionState(
  queryClient: Pick<QueryClient, "clear">,
  options: ClearSessionOptions = {},
  actions: ClearSessionActions,
): void {
  if (options.clearDrafts) actions.clearDrafts();
  queryClient.clear();
  actions.logout();
  if (options.broadcast) actions.publish(options.broadcast);
  actions.redirectToLogin();
}
